import { Capacitor } from '@capacitor/core';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('gourmet_api_url');
    if (saved && saved.trim()) return saved.trim();

    // Native mobile app (Android / BlueStacks / iOS): default to live cloud API
    if (Capacitor.isNativePlatform()) {
      return 'https://restaurant-system-ipd2.onrender.com/api';
    }

    const host = window.location.hostname;
    // Localhost development in desktop browser
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4001/api';
    }
    // LAN Wi-Fi development (e.g. tablet/phone connected to host IP on port 5180)
    if ((window.location.port === '5180' || window.location.port === '5173') && (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.'))) {
      return `http://${host}:4001/api`;
    }

    // Direct web access (e.g. on Render, domain, or server port 4001)
    if (window.location.origin && window.location.port !== '5180' && window.location.port !== '5173') {
      return `${window.location.origin}/api`;
    }
  }

  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim();

  return 'https://restaurant-system-ipd2.onrender.com/api';
}

export function getWsBaseUrl(): string {
  const apiBase = getApiBaseUrl();
  return apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws');
}

export function setCustomApiUrl(url: string | null) {
  if (url && url.trim()) {
    localStorage.setItem('gourmet_api_url', url.trim());
  } else {
    localStorage.removeItem('gourmet_api_url');
  }
  window.location.reload();
}

export interface SyncItem {
  id: string;
  endpoint: string;
  method: string;
  body: any;
  timestamp: number;
}

class ApiClient {
  private token: string | null = localStorage.getItem('token');
  private syncQueue: SyncItem[] = JSON.parse(localStorage.getItem('offline_queue') || '[]');
  private ws: WebSocket | null = null;
  private wsListeners: ((event: any) => void)[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosing = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private wsConnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor() {
    window.addEventListener('online', () => this.flushQueue());
    this.initWebSocket();

    // Heartbeat to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    this.reconnectWebSocket();
  }

  getToken() {
    return this.token;
  }

  private statusListeners: ((connected: boolean) => void)[] = [];

  onStatusChange(callback: (connected: boolean) => void) {
    this.statusListeners.push(callback);
    callback(this.isConnected);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== callback);
    };
  }

  private notifyStatus(connected: boolean) {
    this.statusListeners.forEach(listener => {
      try { listener(connected); } catch (e) { console.error('[WS] Status listener error:', e); }
    });
  }

  /**
   * Initialize or reinitialize the WebSocket connection.
   * This is called once on app startup and when the token changes.
   */
  private initWebSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const wsBase = getWsBaseUrl();
    const url = this.token ? `${wsBase}?token=${this.token}` : wsBase;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] Connected successfully');
      this.wsConnectAttempts = 0;
      this.notifyStatus(true);
      // Authenticate explicitly if token exists
      if (this.token) {
        this.ws?.send(JSON.stringify({ type: 'AUTH', token: this.token }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Ignore pong responses
        if (data.type === 'PONG' || data.type === 'AUTH_SUCCESS') return;
        this.wsListeners.forEach(listener => listener(data));
      } catch (e) {
        console.error('[WS] Error parsing message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Connection closed');
      this.notifyStatus(false);
      // Auto-reconnect unless we intentionally closed it
      if (!this.intentionallyClosing) {
        this.scheduleReconnect();
      }
      this.intentionallyClosing = false;
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      this.notifyStatus(false);
    };
  }

  /**
   * Called when the token changes (e.g., user logs in).
   * Closes the old socket cleanly and opens a new authenticated one.
   */
  private reconnectWebSocket() {
    // Cancel any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Cancel the old socket's onclose from triggering reconnection
    if (this.ws) {
      this.intentionallyClosing = true;
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }

    // Small delay to let the old socket fully close
    setTimeout(() => {
      this.intentionallyClosing = false;
      this.initWebSocket();
    }, 500);
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  private scheduleReconnect() {
    if (this.wsConnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.wsConnectAttempts), 30000); // Cap at 30s
    this.wsConnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.wsConnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.initWebSocket();
    }, delay);
  }

  onEvent(callback: (event: any) => void) {
    this.wsListeners.push(callback);
    return () => {
      this.wsListeners = this.wsListeners.filter(l => l !== callback);
    };
  }

  // HTTP Request with Offline Queue support for Mutations
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || 'GET');

    try {
      const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        const errorMessage = typeof errorData.error === 'string'
          ? errorData.error
          : (errorData.error?.message || errorData.message || `HTTP ${response.status}: Request failed`);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (err: any) {
      // If network offline and is a mutation, enqueue locally for auto-sync!
      if (!navigator.onLine && isMutation) {
        const syncItem: SyncItem = {
          id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          endpoint,
          method: options.method || 'POST',
          body: options.body ? JSON.parse(options.body as string) : null,
          timestamp: Date.now()
        };
        this.syncQueue.push(syncItem);
        localStorage.setItem('offline_queue', JSON.stringify(this.syncQueue));

        window.dispatchEvent(new CustomEvent('sync_queue_updated', { detail: this.syncQueue.length }));

        return {
          queuedOffline: true,
          message: 'Saved offline. Will synchronize automatically once connection returns.'
        } as unknown as T;
      }

      throw err;
    }
  }

  async flushQueue() {
    if (this.syncQueue.length === 0 || !navigator.onLine) return;

    const queueCopy = [...this.syncQueue];
    this.syncQueue = [];
    localStorage.setItem('offline_queue', JSON.stringify([]));

    for (const item of queueCopy) {
      try {
        await this.request(item.endpoint, {
          method: item.method,
          body: JSON.stringify(item.body)
        });
      } catch (err) {
        console.error('Failed to flush offline sync item:', item, err);
      }
    }

    window.dispatchEvent(new CustomEvent('sync_queue_updated', { detail: 0 }));
  }

  getQueueCount() {
    return this.syncQueue.length;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const api = new ApiClient();

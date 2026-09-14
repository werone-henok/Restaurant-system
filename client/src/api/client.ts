const API_BASE_URL = 'https://gourmetos-api.onrender.com/api';
const WS_BASE = API_BASE_URL.replace(/^http/, 'ws').replace(/\/api$/, '/ws');

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

  constructor() {
    window.addEventListener('online', () => this.flushQueue());
    this.initWebSocket();
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    this.initWebSocket();
  }

  getToken() {
    return this.token;
  }

  initWebSocket() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) { }
    }

    const url = this.token ? `${WS_BASE}?token=${this.token}` : WS_BASE;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.wsListeners.forEach(listener => listener(data));
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    this.ws.onclose = () => {
      // Reconnect after 3s
      setTimeout(() => this.initWebSocket(), 3000);
    };
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
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
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
}

export const api = new ApiClient();

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/env.js';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  role: string;
  branchId: string;
  isAuthenticated: boolean;
}

const activeClients = new Map<WebSocket, ClientConnection>();

// Track clients needing re-authentication (token passed in URL)
const pendingAuthClients = new Map<WebSocket, string>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');

    let clientInfo: ClientConnection | null = null;

    // Try to authenticate from URL token on connection
    if (token) {
      try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as any;
        clientInfo = {
          ws,
          userId: decoded.id,
          role: decoded.role,
          branchId: decoded.branch_id,
          isAuthenticated: true
        };
        activeClients.set(ws, clientInfo);
        console.log(`[WS] Authenticated via URL token: ${decoded.username} (${decoded.role})`);
      } catch (err) {
        console.log('[WS] Token from URL invalid, waiting for AUTH message');
        pendingAuthClients.set(ws, token);
      }
    }

    // Handle incoming messages
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle heartbeat
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', serverTime: new Date().toISOString() }));
          return;
        }

        if (data.type === 'AUTH') {
          try {
            const decoded = jwt.verify(data.token, CONFIG.JWT_SECRET) as any;
            // Update or create client entry
            const existingClient = activeClients.get(ws);
            activeClients.set(ws, {
              ws,
              userId: decoded.id,
              role: decoded.role,
              branchId: data.branchId || decoded.branch_id,
              isAuthenticated: true
            });
            pendingAuthClients.delete(ws);
            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user: decoded }));
            console.log(`[WS] Re-authenticated via AUTH message: ${decoded.username}`);
          } catch (e) {
            ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Invalid token' }));
          }
          return;
        }

        if (data.type === 'SWITCH_BRANCH') {
          const client = activeClients.get(ws);
          if (client) {
            client.branchId = data.branchId;
            ws.send(JSON.stringify({ type: 'BRANCH_SWITCHED', branchId: data.branchId }));
          }
          return;
        }
      } catch (e) {
        // invalid JSON - ignore
      }
    });

    ws.on('close', () => {
      activeClients.delete(ws);
      pendingAuthClients.delete(ws);
    });

    // Send welcome immediately
    ws.send(JSON.stringify({ type: 'CONNECTED', serverTime: new Date().toISOString() }));

    // If client was pre-authenticated via URL, send confirmation
    if (clientInfo?.isAuthenticated) {
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user: { id: clientInfo.userId, role: clientInfo.role, branch_id: clientInfo.branchId } }));
      }, 100);
    }
  });
}

export function broadcastEvent(event: {
  type: string;
  branchId?: string | null;
  targetRole?: string | string[];
  payload: any;
}) {
  const messageStr = JSON.stringify(event);

  for (const [ws, client] of activeClients.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;

    // Filter by branch: Owner receives all branch updates, or matches branchId
    const branchMatch = !event.branchId || client.role === 'owner' || client.branchId === event.branchId;
    if (!branchMatch) continue;

    // Filter by role if specified
    if (event.targetRole) {
      const allowedRoles = Array.isArray(event.targetRole) ? event.targetRole : [event.targetRole];
      if (!allowedRoles.includes(client.role) && client.role !== 'owner' && client.role !== 'admin') {
        continue;
      }
    }

    try {
      ws.send(messageStr);
    } catch (e) {
      console.error('[WS] Failed to send to client:', e);
      activeClients.delete(ws);
    }
  }
}

/**
 * Get count of active authenticated connections (for debugging)
 */
export function getActiveConnectionCount(): number {
  let count = 0;
  for (const [, client] of activeClients.entries()) {
    if (client.isAuthenticated) count++;
  }
  return count;
}

/**
 * Get connections by role (for debugging)
 */
export function getConnectionsByRole(role: string): number {
  let count = 0;
  for (const [, client] of activeClients.entries()) {
    if (client.role === role) count++;
  }
  return count;
}

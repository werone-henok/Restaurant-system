import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/env.js';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  role: string;
  branchId: string;
}

const activeClients = new Map<WebSocket, ClientConnection>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');

    if (!token) {
      // Allow anonymous connection initially or close
      // For real-time updates we can authenticate via message or query parameter
    }

    let authenticatedUser: any = null;
    if (token) {
      try {
        authenticatedUser = jwt.verify(token, CONFIG.JWT_SECRET);
        activeClients.set(ws, {
          ws,
          userId: authenticatedUser.id,
          role: authenticatedUser.role,
          branchId: authenticatedUser.branch_id
        });
      } catch (err) {
        // Token invalid, still allow registering via first message
      }
    }

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'AUTH') {
          try {
            const decoded = jwt.verify(data.token, CONFIG.JWT_SECRET) as any;
            activeClients.set(ws, {
              ws,
              userId: decoded.id,
              role: decoded.role,
              branchId: data.branchId || decoded.branch_id
            });
            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user: decoded }));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Invalid token' }));
          }
        } else if (data.type === 'SWITCH_BRANCH') {
          const client = activeClients.get(ws);
          if (client) {
            client.branchId = data.branchId;
            ws.send(JSON.stringify({ type: 'BRANCH_SWITCHED', branchId: data.branchId }));
          }
        }
      } catch (e) {
        // invalid JSON
      }
    });

    ws.on('close', () => {
      activeClients.delete(ws);
    });

    // Send initial ping/welcome
    ws.send(JSON.stringify({ type: 'CONNECTED', serverTime: new Date().toISOString() }));
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

    ws.send(messageStr);
  }
}

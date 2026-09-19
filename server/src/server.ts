import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import { CONFIG } from './config/env.js';
import { getDatabase } from './database/connection.js';
import { seedDatabase } from './database/seed.js';
import { setupWebSocket } from './services/websocket.js';
import { authRateLimiter, globalRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import { authRouter } from './routes/auth.js';
import { branchRouter } from './routes/branches.js';
import { tableRouter } from './routes/tables.js';
import { menuRouter } from './routes/menu.js';
import { orderRouter } from './routes/orders.js';
import { paymentRouter } from './routes/payments.js';
import { inventoryRouter } from './routes/inventory.js';
import { expenseRouter } from './routes/expenses.js';
import { attendanceRouter } from './routes/attendance.js';
import { reportRouter } from './routes/reports.js';
import { adminRouter } from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  await getDatabase();
  seedDatabase();

  const app = express();
  const server = http.createServer(app);

  // WebSocket server attached to HTTP server
  const wss = new WebSocketServer({ server, path: '/ws' });
  setupWebSocket(wss);

  // ── Security headers ──────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ──────────────────────────────────────────────────────────
  // CONFIG.CORS_ORIGINS is already a string[] from env.ts
  app.use(cors({ origin: CONFIG.CORS_ORIGINS, credentials: true }));

  // ── Body parsers ──────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Global rate limiting ──────────────────────────────────────────
  app.use(globalRateLimiter);

  // ── Auth-specific rate limiting (tighter) ─────────────────────────
  app.use('/api/auth', authRateLimiter);

  // ── Static client build ───────────────────────────────────────────
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // ── Health check ──────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'HEALTHY',
      service: 'GourmetOS Restaurant Platform Server',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) {
        res.redirect('http://localhost:5173');
      }
    });
  });

  // ── API Routes ────────────────────────────────────────────────────
  app.use('/api/auth', authRouter);
  app.use('/api/branches', branchRouter);
  app.use('/api/tables', tableRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/expenses', expenseRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/reports', reportRouter);
  app.use('/api/admin', adminRouter);

  // ── 404 catch-all for unmatched API routes ─────────────────────────
  app.all('/api/*', notFoundHandler);

  // ── Centralized error handler (must be last middleware) ────────────
  app.use(errorHandler);

  server.listen(CONFIG.PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 GourmetOS Server running on http://localhost:${CONFIG.PORT}`);
    console.log(`⚡ WebSocket endpoint available at ws://localhost:${CONFIG.PORT}/ws`);
    console.log(`====================================================`);
  });
}

bootstrap().catch(err => {
  console.error('FATAL: Failed to bootstrap GourmetOS server:', err);
});

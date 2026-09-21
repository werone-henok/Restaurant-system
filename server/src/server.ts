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
import { uploadRouter } from './routes/upload.js';
import { notificationRouter } from './routes/notifications.js';
import { initBackupScheduler } from './services/backupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  await getDatabase();
  seedDatabase();
  initBackupScheduler();

  const app = express();
  const server = http.createServer(app);

  // WebSocket server attached to HTTP server
  const wss = new WebSocketServer({ server, path: '/ws' });
  setupWebSocket(wss);

  // ── Security headers ──────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*", "https://*"],
        mediaSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    }
  }));

  // ── CORS ──────────────────────────────────────────────────────────
  const allowedOrigins = new Set(CONFIG.CORS_ORIGINS);
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile native apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.has(origin) ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('https://localhost') ||
        origin.startsWith('capacitor://') ||
        origin.startsWith('ionic://') ||
        origin.endsWith('.onrender.com')
      ) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true
  }));

  // ── Body parsers ──────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Global rate limiting ──────────────────────────────────────────
  app.use(globalRateLimiter);

  // ── Auth-specific rate limiting (tighter) ─────────────────────────
  app.use('/api/auth', authRateLimiter);

  // ── Static client build & Uploads directory ───────────────────────
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  const uploadsDir = path.resolve(__dirname, '../../uploads');
  app.use('/uploads', express.static(uploadsDir));

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
  app.use('/api/upload', uploadRouter);
  app.use('/api/notifications', notificationRouter);

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

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
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
import { restoreLatestFromCloud, initAutoSync, downloadImageFromCloud, uploadImageToCloud, healMissingUploadedImages } from './services/cloudSyncService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { initDatabase, runMigrations } from './database/schema.js';

async function bootstrap() {
  // ── Cloud Database Synchronization (Restore before SQLite init) ──
  await restoreLatestFromCloud();

  await getDatabase();
  initDatabase();
  runMigrations();
  seedDatabase();
  healMissingUploadedImages().catch(e => console.warn('[CloudSync] Notice during missing images healing:', e));
  initBackupScheduler();
  initAutoSync();

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
  const possibleClientDirs = [
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../server/public'),
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
    path.resolve(__dirname, 'public')
  ];

  const clientDist = possibleClientDirs.find(d => fs.existsSync(path.join(d, 'index.html'))) || possibleClientDirs[0];
  console.log(`[Static] Serving web client from: ${clientDist} (index.html exists: ${fs.existsSync(path.join(clientDist, 'index.html'))})`);

  app.use(express.static(clientDist));

  // ── Uploads handling (Local filesystem cache + Cloud persistence fallback) ──
  if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
    fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
  }

  // 1. Fast static delivery if file is cached locally
  app.use('/uploads', express.static(CONFIG.UPLOAD_DIR));

  // 2. Cloud fallback: if file was wiped from container disk (e.g. Render restart/redeploy)
  app.get('/uploads/:filename', async (req, res) => {
    const filename = path.basename(req.params.filename);
    const localPath = path.join(CONFIG.UPLOAD_DIR, filename);

    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 100) {
      return res.sendFile(localPath);
    }

    try {
      const cloudFile = await downloadImageFromCloud(filename);
      if (cloudFile && cloudFile.buffer.length > 100) {
        try {
          fs.writeFileSync(localPath, cloudFile.buffer);
        } catch (_) {}

        res.setHeader('Content-Type', cloudFile.contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(cloudFile.buffer);
      }
    } catch (cloudErr) {
      console.warn(`[Uploads] Could not retrieve "${filename}" from cloud storage:`, cloudErr);
    }

    // 3. Fallback for the known "Yo Special Burger" photo if neither local nor remote exists yet
    if (filename.includes('1790175331011') || filename.toLowerCase().includes('burger')) {
      try {
        const fallbackResp = await fetch('https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80');
        if (fallbackResp.ok) {
          const buf = Buffer.from(await fallbackResp.arrayBuffer());
          try { fs.writeFileSync(localPath, buf); } catch (_) {}
          uploadImageToCloud(filename, buf, 'image/jpeg').catch(() => {});
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return res.send(buf);
        }
      } catch (_) {}
    }

    return res.status(404).json({ error: 'Image not found' });
  });

  // ── Health check ──────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'HEALTHY',
      service: 'GourmetOS Restaurant Platform Server',
      timestamp: new Date().toISOString()
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

  // ── SPA Catch-all (Serves React web app on all web routes) ────────
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/uploads')) {
      return next();
    }
    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).send(`
        <!DOCTYPE html>
        <html>
        <head><title>GourmetOS</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:sans-serif;text-align:center;padding:50px 20px;">
          <h2>GourmetOS Restaurant System</h2>
          <p>Web application bundle is compiling or initializing. Please refresh in a moment.</p>
        </body>
        </html>
      `);
    }
  });

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

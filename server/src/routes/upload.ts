import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { CONFIG } from '../config/env.js';
import { uploadImageToCloud } from '../services/cloudSyncService.js';

if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}

export const uploadRouter = Router();

// Allowed MIME types and their magic byte signatures
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP)
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]]  // GIF8
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB hard limit

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;
  return signatures.some(sig => sig.every((byte, idx) => buffer[idx] === byte));
}

uploadRouter.post('/', authenticate, async (req, res) => {
  try {
    const { dataUrl, filename } = req.body;

    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'dataUrl is required' });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid data URL format' });
    }

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];

    // 1. Validate MIME type against allowlist
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ error: `File type "${mimeType}" is not allowed. Only images (JPEG, PNG, WebP, GIF) are accepted.` });
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // 2. Enforce file size limit
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({ error: `File is too large (${Math.round(buffer.length / 1024)} KB). Maximum allowed size is 5 MB.` });
    }

    // 3. Validate magic bytes (prevent disguised executables/scripts)
    if (!validateMagicBytes(buffer, mimeType)) {
      return res.status(400).json({ error: 'File content does not match the declared image type. Upload rejected.' });
    }

    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';

    const safePrefix = (filename || 'menu_item')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 20);

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const outFileName = `${safePrefix}_${Date.now()}_${randomSuffix}.${ext}`;
    const filePath = path.join(CONFIG.UPLOAD_DIR, outFileName);

    if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
      fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    // Persist permanently to Supabase Storage
    await uploadImageToCloud(outFileName, buffer, mimeType);

    const publicUrl = `/uploads/${outFileName}`;
    res.json({
      url: publicUrl,
      sizeBytes: buffer.length,
      sizeKb: Math.round(buffer.length / 1024)
    });
  } catch (err: any) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to save uploaded image' });
  }
});


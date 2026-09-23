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
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        let ext = 'jpg';
        if (mimeType.includes('png'))
            ext = 'png';
        else if (mimeType.includes('webp'))
            ext = 'webp';
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
    }
    catch (err) {
        console.error('Image upload error:', err);
        res.status(500).json({ error: err.message || 'Failed to save uploaded image' });
    }
});

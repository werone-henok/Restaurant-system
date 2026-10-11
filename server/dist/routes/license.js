import { Router } from 'express';
import { getActiveLicenseStatus, activateLicense, getHardwareMachineId } from '../services/licenseService.js';
export const licenseRouter = Router();
/**
 * Public: Get current system license status and machine hardware fingerprint
 */
licenseRouter.get('/status', (_req, res) => {
    try {
        const status = getActiveLicenseStatus();
        res.json(status);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to check license status' });
    }
});
/**
 * Public: Quick access to this machine's unique hardware fingerprint
 */
licenseRouter.get('/machine-id', (_req, res) => {
    res.json({
        machineId: getHardwareMachineId(),
        platform: process.platform,
        hostname: process.env.COMPUTERNAME || process.env.HOSTNAME || 'Server'
    });
});
/**
 * Public / Admin: Activate a license token
 */
licenseRouter.post('/activate', (req, res) => {
    try {
        const { licenseToken } = req.body;
        if (!licenseToken || typeof licenseToken !== 'string') {
            return res.status(400).json({ error: 'License token string is required.' });
        }
        const result = activateLicense(licenseToken.trim());
        if (!result.valid) {
            return res.status(400).json({
                error: result.message,
                status: result.status,
                currentMachineId: result.currentMachineId,
                licenseDetails: result.licenseDetails
            });
        }
        res.json({
            success: true,
            message: 'GourmetOS successfully activated for this machine.',
            license: result
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Activation failed.' });
    }
});

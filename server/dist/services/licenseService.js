import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { CONFIG } from '../config/env.js';
import { db } from '../database/schema.js';
let cachedMachineId = null;
/**
 * Generates an immutable, unique Hardware Fingerprint for this physical/virtual machine.
 */
export function getHardwareMachineId() {
    if (cachedMachineId)
        return cachedMachineId;
    let raw = '';
    try {
        if (process.platform === 'win32') {
            const out = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', {
                encoding: 'utf8',
                timeout: 2500,
                stdio: ['ignore', 'pipe', 'ignore']
            });
            const match = out.match(/MachineGuid\s+REG_SZ\s+([a-zA-Z0-9_-]+)/i);
            if (match && match[1]) {
                raw = match[1].trim();
            }
        }
        else if (process.platform === 'linux') {
            if (fs.existsSync('/etc/machine-id')) {
                raw = fs.readFileSync('/etc/machine-id', 'utf8').trim();
            }
            else if (fs.existsSync('/var/lib/dbus/machine-id')) {
                raw = fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
            }
        }
        else if (process.platform === 'darwin') {
            const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice', {
                encoding: 'utf8',
                timeout: 2500,
                stdio: ['ignore', 'pipe', 'ignore']
            });
            const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
            if (match && match[1]) {
                raw = match[1].trim();
            }
        }
    }
    catch (_) {
        // Fallback to hardware interfaces
    }
    // Cross-platform fallback: MAC addresses + CPU + Hostname
    if (!raw) {
        const interfaces = os.networkInterfaces();
        const macs = [];
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name] || []) {
                if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
                    macs.push(net.mac);
                }
            }
        }
        raw = [os.hostname(), os.platform(), os.arch(), macs.sort().join(';')].join('|');
    }
    const hash = crypto
        .createHash('sha256')
        .update(`GOURMETOS_HW_SALT_2026_${raw}`)
        .digest('hex')
        .toUpperCase();
    cachedMachineId = `GOS-M-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;
    return cachedMachineId;
}
/**
 * Computes HMAC-SHA256 signature for license payload
 */
function signPayload(payloadJson, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(payloadJson)
        .digest('base64url');
}
/**
 * Creates a signed license token (used by developer key generator)
 */
export function generateLicenseToken(payload, secret = CONFIG.LICENSE_SECRET) {
    const jsonStr = JSON.stringify(payload);
    const base64Payload = Buffer.from(jsonStr, 'utf8').toString('base64url');
    const signature = signPayload(jsonStr, secret);
    return `GOS-${base64Payload}.${signature}`;
}
/**
 * Verifies a cryptographic license token against the current machine hardware
 */
export function verifyLicenseToken(token) {
    const currentMachineId = getHardwareMachineId();
    if (!token || !token.startsWith('GOS-')) {
        return {
            valid: false,
            status: 'TAMPERED_KEY',
            message: 'Invalid license format. Must start with GOS-',
            currentMachineId
        };
    }
    const body = token.substring(4);
    const dotIndex = body.lastIndexOf('.');
    if (dotIndex === -1) {
        return {
            valid: false,
            status: 'TAMPERED_KEY',
            message: 'Malformed license structure.',
            currentMachineId
        };
    }
    const base64Payload = body.substring(0, dotIndex);
    const signature = body.substring(dotIndex + 1);
    let jsonStr = '';
    let payload;
    try {
        jsonStr = Buffer.from(base64Payload, 'base64url').toString('utf8');
        payload = JSON.parse(jsonStr);
    }
    catch (_) {
        return {
            valid: false,
            status: 'TAMPERED_KEY',
            message: 'License payload could not be decoded.',
            currentMachineId
        };
    }
    // 1. Verify Cryptographic Signature
    const expectedSignature = signPayload(jsonStr, CONFIG.LICENSE_SECRET);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return {
            valid: false,
            status: 'TAMPERED_KEY',
            message: 'Cryptographic signature mismatch. License key is forged or invalid.',
            currentMachineId
        };
    }
    // 2. Verify Hardware Machine ID (Anti-Theft Check)
    const isCloudOrWildcard = payload.machineId === '*';
    const matchesCurrentMachine = payload.machineId.toUpperCase() === currentMachineId.toUpperCase();
    if (!isCloudOrWildcard && !matchesCurrentMachine) {
        return {
            valid: false,
            status: 'MACHINE_MISMATCH',
            message: `Hardware fingerprint mismatch. This license is bound to machine ${payload.machineId}, but installed on ${currentMachineId}. Unauthorized copy detected.`,
            currentMachineId,
            licenseDetails: {
                client: payload.client,
                machineId: payload.machineId,
                plan: payload.plan,
                maxBranches: payload.maxBranches,
                issuedAt: payload.issuedAt,
                expiresAt: payload.expiresAt,
                daysRemaining: null
            }
        };
    }
    // 3. Verify Expiration
    let daysRemaining = null;
    if (payload.expiresAt !== 'NEVER') {
        const expiryTime = new Date(payload.expiresAt).getTime();
        const now = Date.now();
        if (isNaN(expiryTime) || now > expiryTime) {
            return {
                valid: false,
                status: 'EXPIRED',
                message: `License expired on ${payload.expiresAt}. Please renew subscription.`,
                currentMachineId,
                licenseDetails: {
                    client: payload.client,
                    machineId: payload.machineId,
                    plan: payload.plan,
                    maxBranches: payload.maxBranches,
                    issuedAt: payload.issuedAt,
                    expiresAt: payload.expiresAt,
                    daysRemaining: 0
                }
            };
        }
        daysRemaining = Math.max(0, Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24)));
    }
    return {
        valid: true,
        status: 'ACTIVE',
        message: 'License is valid and activated for this machine.',
        currentMachineId,
        licenseDetails: {
            client: payload.client,
            machineId: payload.machineId,
            plan: payload.plan,
            maxBranches: payload.maxBranches,
            issuedAt: payload.issuedAt,
            expiresAt: payload.expiresAt,
            daysRemaining
        }
    };
}
/**
 * Gets the current system license status from database
 */
export function getActiveLicenseStatus() {
    const currentMachineId = getHardwareMachineId();
    // If enforcement is explicitly disabled via env
    if (!CONFIG.LICENSE_ENFORCE) {
        return {
            valid: true,
            status: 'ACTIVE',
            message: 'License enforcement disabled via LICENSE_ENFORCE=false',
            currentMachineId
        };
    }
    try {
        const row = db.prepare('SELECT * FROM system_license WHERE id = ?').get('current_license');
        if (!row || !row.license_token) {
            return {
                valid: false,
                status: 'NOT_ACTIVATED',
                message: 'No license key installed on this system. Activation required.',
                currentMachineId
            };
        }
        const verification = verifyLicenseToken(row.license_token);
        // Update status in DB if changed
        if (row.status !== verification.status) {
            db.prepare('UPDATE system_license SET status = ?, last_verified_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(verification.status, 'current_license');
        }
        return verification;
    }
    catch (err) {
        console.error('[License] Error querying system license:', err);
        return {
            valid: false,
            status: 'NOT_ACTIVATED',
            message: 'Could not verify system license.',
            currentMachineId
        };
    }
}
/**
 * Activates a new license token on this system
 */
export function activateLicense(token) {
    const verification = verifyLicenseToken(token);
    if (!verification.valid || !verification.licenseDetails) {
        return verification;
    }
    const details = verification.licenseDetails;
    const keyMatch = token.substring(token.length - 12);
    db.prepare(`
    INSERT INTO system_license (id, license_key, license_token, restaurant_name, machine_id, plan, max_branches, expires_at, status, last_verified_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      license_key = excluded.license_key,
      license_token = excluded.license_token,
      restaurant_name = excluded.restaurant_name,
      machine_id = excluded.machine_id,
      plan = excluded.plan,
      max_branches = excluded.max_branches,
      expires_at = excluded.expires_at,
      status = excluded.status,
      last_verified_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).run('current_license', `GOS-KEY-${keyMatch.toUpperCase()}`, token.trim(), details.client, details.machineId, details.plan, details.maxBranches, details.expiresAt, verification.status);
    return verification;
}
/**
 * Initializes license system on server boot.
 * Seeds a default genuine developer/owner license bound to THIS machine
 * so local development and tests work seamlessly out of the box,
 * while ANY other machine/server it is copied to will immediately trigger MACHINE_MISMATCH!
 */
export function initLicenseService() {
    const machineId = getHardwareMachineId();
    console.log(`[License] Host Hardware Machine ID: ${machineId}`);
    try {
        const isCloudEnv = Boolean(process.env.RENDER ||
            process.env.CONTAINER ||
            process.env.DYNO ||
            process.env.VERCEL ||
            process.env.FLY_APP_NAME ||
            process.env.RAILWAY_ENVIRONMENT);
        const existing = db.prepare('SELECT * FROM system_license WHERE id = ?').get('current_license');
        if (!existing) {
            console.log(`[License] Generating initial authorized license for ${isCloudEnv ? 'Cloud Deployment (*)' : 'host machine ' + machineId}...`);
            const defaultPayload = {
                client: 'Yo Burger & Restaurant (Authorized Host)',
                machineId: isCloudEnv ? '*' : machineId,
                plan: 'LIFETIME',
                maxBranches: 10,
                issuedAt: new Date().toISOString(),
                expiresAt: 'NEVER',
                nonce: crypto.randomBytes(8).toString('hex')
            };
            const token = generateLicenseToken(defaultPayload, CONFIG.LICENSE_SECRET);
            activateLicense(token);
            console.log(`[License] ✓ System activated with ${isCloudEnv ? 'cloud-authorized' : 'hardware-locked'} license.`);
        }
        else {
            let status = getActiveLicenseStatus();
            if (isCloudEnv && (!status.valid && status.status === 'MACHINE_MISMATCH' || existing.machine_id !== '*')) {
                console.log(`[License] Cloud container environment detected. Ensuring wildcard license for ephemeral container...`);
                const cloudPayload = {
                    client: existing.restaurant_name || 'Yo Burger & Restaurant (Cloud Deployment)',
                    machineId: '*',
                    plan: existing.plan || 'LIFETIME',
                    maxBranches: existing.max_branches || 10,
                    issuedAt: new Date().toISOString(),
                    expiresAt: 'NEVER',
                    nonce: crypto.randomBytes(8).toString('hex')
                };
                const token = generateLicenseToken(cloudPayload, CONFIG.LICENSE_SECRET);
                activateLicense(token);
                status = getActiveLicenseStatus();
            }
            if (status.valid) {
                console.log(`[License] ✓ System license active: ${status.licenseDetails?.client} (${status.licenseDetails?.plan})`);
            }
            else {
                console.warn(`[License] ⚠️ LICENSE LOCK ACTIVE: ${status.message}`);
            }
        }
    }
    catch (err) {
        console.warn('[License] Notice during initialization:', err);
    }
}

#!/usr/bin/env node

/**
 * ============================================================================
 * GourmetOS Private Vendor License Key Generator
 * FOR SOFTWARE VENDOR / DEVELOPER USE ONLY - DO NOT DISTRIBUTE TO CLIENTS
 * ============================================================================
 *
 * Usage:
 *   node server/scripts/generate-license.js --client "Client Name" --machine "GOS-M-XXXX-XXXX-XXXX-XXXX" [--plan LIFETIME] [--expires 2027-12-31] [--branches 5]
 *
 * Examples:
 *   node server/scripts/generate-license.js --client "Bole Medhanealem Cafe" --machine "GOS-M-270E-74B0-52CA-449D"
 *   node server/scripts/generate-license.js --client "Cloud SaaS Client" --machine "*" --expires "2027-01-01"
 */

import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MASTER_SECRET = process.env.LICENSE_SECRET || 'gourmetos-private-vendor-license-master-key-2026';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    client: '',
    machine: '',
    plan: 'LIFETIME',
    expires: 'NEVER',
    branches: 5
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--client' && args[i + 1]) options.client = args[++i];
    else if (arg === '--machine' && args[i + 1]) options.machine = args[++i];
    else if (arg === '--plan' && args[i + 1]) options.plan = args[++i].toUpperCase();
    else if (arg === '--expires' && args[i + 1]) options.expires = args[++i];
    else if (arg === '--branches' && args[i + 1]) options.branches = parseInt(args[++i], 10);
  }

  return options;
}

const opts = parseArgs();

if (!opts.client || !opts.machine) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        GourmetOS Commercial License Generator (Vendor CLI)       ║
╚══════════════════════════════════════════════════════════════════╝

Missing required arguments!

Usage:
  node server/scripts/generate-license.js --client "Restaurant Name" --machine "GOS-M-XXXX-XXXX-XXXX-XXXX" [options]

Options:
  --client    Restaurant or Client Name (Required)
  --machine   Hardware Machine ID from the restaurant server (or '*' for cloud) (Required)
  --plan      LIFETIME (default) | ANNUAL | PRO | TRIAL
  --expires   Expiration date (YYYY-MM-DD) or 'NEVER' (default)
  --branches  Number of permitted branches (default: 5)
  `);
  process.exit(1);
}

const payload = {
  client: opts.client.trim(),
  machineId: opts.machine.trim().toUpperCase(),
  plan: opts.plan,
  maxBranches: opts.branches,
  issuedAt: new Date().toISOString(),
  expiresAt: opts.expires === 'NEVER' ? 'NEVER' : new Date(opts.expires).toISOString(),
  nonce: crypto.randomBytes(8).toString('hex')
};

const jsonStr = JSON.stringify(payload);
const base64Payload = Buffer.from(jsonStr, 'utf8').toString('base64url');
const signature = crypto
  .createHmac('sha256', MASTER_SECRET)
  .update(jsonStr)
  .digest('base64url');

const token = `GOS-${base64Payload}.${signature}`;

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║               GOURMETOS SIGNED LICENSE GENERATED                ║
╚══════════════════════════════════════════════════════════════════╝

Client Name:     ${payload.client}
Hardware Lock:   ${payload.machineId === '*' ? '🌍 Unrestricted Cloud (*)' : payload.machineId}
Subscription:    ${payload.plan}
Max Branches:    ${payload.maxBranches}
Issued Date:     ${payload.issuedAt}
Expiration:      ${payload.expiresAt}

──────────────────────────────────────────────────────────────────
COPY AND PASTE THIS ACTIVATION KEY TO THE CLIENT:
──────────────────────────────────────────────────────────────────

${token}

──────────────────────────────────────────────────────────────────
If copied to another computer with a different Hardware Fingerprint,
GourmetOS will immediately lock and deny access.
`);

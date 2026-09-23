import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDir = path.resolve(__dirname, '../client');
const publicDir = path.resolve(__dirname, 'public');

console.log('=== STARTING GOURMETOS UNIFIED BUILD ===');

if (fs.existsSync(clientDir)) {
  console.log('1. Checking and building frontend web client...');
  try {
    const clientModules = path.join(clientDir, 'node_modules');
    if (!fs.existsSync(clientModules)) {
      console.log('   Installing client dependencies...');
      execSync('npm install --include=dev', { cwd: clientDir, stdio: 'inherit' });
    }

    execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
    console.log('   ✓ Client web build completed successfully');

    const clientDist = path.join(clientDir, 'dist');
    if (fs.existsSync(clientDist)) {
      console.log('2. Syncing client build into server/public for standalone hosting...');
      if (fs.existsSync(publicDir)) {
        fs.rmSync(publicDir, { recursive: true, force: true });
      }
      fs.cpSync(clientDist, publicDir, { recursive: true });
      console.log('   ✓ Copied to server/public');
    }
  } catch (err) {
    console.error('Frontend build notice:', err);
  }
} else {
  console.log('Notice: ../client directory not present. Skipping frontend build.');
}

console.log('3. Compiling TypeScript server backend...');
execSync('npx tsc', { cwd: __dirname, stdio: 'inherit' });
console.log('=== GOURMETOS BUILD FINISHED SUCCESSFULLY ===');

import { Request, Response, NextFunction } from 'express';
import { getActiveLicenseStatus } from '../services/licenseService.js';

const ALLOWED_UNLICENSED_PATHS = [
  '/api/license',
  '/api/health',
  '/api/auth/login',
  '/api/auth/me'
];

/**
 * Middleware that blocks operational restaurant APIs if the system
 * has been copied to an unauthorized computer or license has expired.
 */
export function licenseEnforcer(req: Request, res: Response, next: NextFunction) {
  // Always permit license endpoints and health checks
  if (ALLOWED_UNLICENSED_PATHS.some(path => req.path.startsWith(path))) {
    return next();
  }

  const license = getActiveLicenseStatus();
  if (license.valid) {
    return next();
  }

  // System is unlicensed or stolen/copied onto another machine
  return res.status(403).json({
    error: 'LICENSE_REQUIRED',
    licenseStatus: license.status,
    message: license.message,
    machineId: license.currentMachineId,
    help: 'This GourmetOS installation requires a valid hardware-locked license key. Contact your vendor with your Machine ID to activate.'
  });
}

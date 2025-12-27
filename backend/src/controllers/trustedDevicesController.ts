import { Response } from 'express';
import { pool, query } from '../config/database';
import { AuthRequest } from '../types';
import { comparePassword } from '../utils/auth';
import {
  getTrustedDevices,
  revokeDevice,
  revokeAllDevices,
  getTrustedDeviceCount,
  generateDeviceFingerprint,
} from '../utils/trustedDevices';

/**
 * Get all trusted devices for the authenticated user
 * GET /api/auth/trusted-devices
 *
 * Returns list of all trusted devices with:
 * - Device name, IP, user agent
 * - When device was trusted
 * - When device expires
 * - Last used timestamp
 * - Whether device is current
 */
export const getDevices = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get current device fingerprint to mark it
    const currentFingerprint = generateDeviceFingerprint(req);

    // Get all trusted devices
    const devices = await getTrustedDevices(
      pool,
      req.user.userId,
      currentFingerprint
    );

    res.json({
      success: true,
      data: {
        devices: devices.map((device) => ({
          id: device.id,
          deviceName: device.deviceName,
          ipAddress: device.ipAddress,
          trustedAt: device.trustedAt,
          expiresAt: device.expiresAt,
          lastUsedAt: device.lastUsedAt,
          isCurrent: device.isCurrent,
        })),
        count: devices.length,
      },
    });
  } catch (error) {
    console.error('Get trusted devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trusted devices',
    });
  }
};

/**
 * Revoke trust for a specific device
 * DELETE /api/auth/trusted-devices/:id
 *
 * Requires:
 * - id: Device ID to revoke (URL parameter)
 *
 * After revocation, 2FA will be required on next login from that device
 */
export const revokeDeviceById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const deviceId = parseInt(req.params.id, 10);

    if (isNaN(deviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device ID',
      });
    }

    // Revoke device
    const revoked = await revokeDevice(pool, req.user.userId, deviceId);

    if (!revoked) {
      return res.status(404).json({
        success: false,
        error: 'Device not found or already revoked',
      });
    }

    res.json({
      success: true,
      message: 'Device trust revoked successfully',
    });
  } catch (error) {
    console.error('Revoke device error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke device',
    });
  }
};

/**
 * Revoke all trusted devices
 * DELETE /api/auth/trusted-devices/all
 *
 * Requires:
 * - password: User's password for security
 *
 * WARNING: This will revoke ALL trusted devices
 * User will need 2FA on ALL devices on next login
 */
export const revokeAllDevicesForUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
      });
    }

    // Get user data
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
      });
    }

    // Revoke all devices
    const revokedCount = await revokeAllDevices(pool, req.user.userId);

    res.json({
      success: true,
      message: 'All trusted devices revoked successfully',
      data: {
        revokedCount,
      },
    });
  } catch (error) {
    console.error('Revoke all devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke all devices',
    });
  }
};

/**
 * Get trusted device count
 * GET /api/auth/trusted-devices/count
 *
 * Returns the number of active trusted devices for the user
 */
export const getDeviceCount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const count = await getTrustedDeviceCount(pool, req.user.userId);

    res.json({
      success: true,
      data: {
        count,
      },
    });
  } catch (error) {
    console.error('Get device count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get device count',
    });
  }
};

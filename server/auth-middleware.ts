import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// Environment variables for auth (should be set in production)
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production";
const AUTH_PASSCODE = process.env.AUTH_PASSCODE || "13";

// Your device information - update these with your actual iPhone Safari details
const ALLOWED_DEVICE = {
  // These will be detected from your iPhone Safari browser
  userAgent: /iPhone.*Safari/i,  // Matches iPhone Safari user agents
  // Additional fingerprints can be added after testing on your device
};

// For development/testing, allow bypass
const DEV_MODE = process.env.NODE_ENV === 'development' || process.env.ALLOW_ALL_DEVICES === 'true';

interface DeviceFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  fingerprint: string;
}

interface AuthenticatedRequest extends Request {
  isAuthenticated?: boolean;
  deviceFingerprint?: DeviceFingerprint;
}

// Generate device fingerprint from request headers
function generateDeviceFingerprint(req: Request): DeviceFingerprint {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  // Create a hash of device characteristics
  const deviceData = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
  const fingerprint = crypto.createHash('sha256').update(deviceData).digest('hex');
  
  return {
    userAgent,
    acceptLanguage,
    acceptEncoding,
    fingerprint
  };
}

// Check if device matches iPhone Safari
function isIPhoneSafari(userAgent: string): boolean {
  if (DEV_MODE) {
    return true;
  }
  
  const isIPhone = /iPhone/i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent) && !/CriOS/i.test(userAgent);
  
  return isIPhone && isSafari;
}

// Generate JWT token for authenticated session
function generateAuthToken(fingerprint: DeviceFingerprint): string {
  const payload = {
    deviceFingerprint: fingerprint.fingerprint,
    userAgent: fingerprint.userAgent,
    issuedAt: Date.now(),
    expiresIn: '30d' // Token expires in 30 days
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

// Verify JWT token and device
function verifyAuthToken(token: string, currentFingerprint: DeviceFingerprint): boolean {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if device fingerprint matches
    if (decoded.deviceFingerprint !== currentFingerprint.fingerprint) {
      return false;
    }
    
    // Check if still iPhone Safari
    if (!isIPhoneSafari(currentFingerprint.userAgent)) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// Authentication endpoint for initial login
export function handleLogin(req: Request, res: Response) {
  const { passcode } = req.body;
  
  // Check passcode (set AUTH_PASSCODE env var to change)
  if (passcode !== AUTH_PASSCODE) {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid passcode" 
    });
  }
  
  const deviceFingerprint = generateDeviceFingerprint(req);
  
  // Check if device is iPhone Safari
  if (!isIPhoneSafari(deviceFingerprint.userAgent)) {
    return res.status(403).json({ 
      success: false, 
      message: "Access restricted to iPhone Safari only" 
    });
  }
  
  // Generate auth token
  const token = generateAuthToken(deviceFingerprint);
  
  // Set secure HTTP-only cookie
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: false, // No TLS termination on this server; httpOnly + sameSite still protect the cookie
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/'
  });
  
  res.json({ 
    success: true, 
    message: "Authentication successful",
    deviceInfo: {
      isIPhone: true,
      isSafari: true,
      fingerprint: deviceFingerprint.fingerprint.substring(0, 8) + '...' // Partial for debugging
    }
  });
}

// Authentication middleware for protected routes
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: "Authentication required" 
    });
  }
  
  const deviceFingerprint = generateDeviceFingerprint(req);
  
  // Verify token and device
  if (!verifyAuthToken(token, deviceFingerprint)) {
    // Clear invalid token
    res.clearCookie('auth_token');
    return res.status(401).json({ 
      success: false, 
      message: "Invalid authentication or device changed" 
    });
  }
  
  // Check if still iPhone Safari (extra security)
  if (!isIPhoneSafari(deviceFingerprint.userAgent)) {
    res.clearCookie('auth_token');
    return res.status(403).json({ 
      success: false, 
      message: "Access restricted to iPhone Safari only" 
    });
  }
  
  // Set authentication flag and device info
  req.isAuthenticated = true;
  req.deviceFingerprint = deviceFingerprint;
  
  next();
}

// Check authentication status (for frontend)
export function checkAuthStatus(req: AuthenticatedRequest, res: Response) {
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.json({ 
      authenticated: false, 
      requiresAuth: true 
    });
  }
  
  const deviceFingerprint = generateDeviceFingerprint(req);
  
  if (!verifyAuthToken(token, deviceFingerprint) || !isIPhoneSafari(deviceFingerprint.userAgent)) {
    res.clearCookie('auth_token');
    return res.json({ 
      authenticated: false, 
      requiresAuth: true 
    });
  }
  
  res.json({ 
    authenticated: true, 
    deviceInfo: {
      isIPhone: true,
      isSafari: true,
      fingerprint: deviceFingerprint.fingerprint.substring(0, 8) + '...'
    }
  });
}

// Logout endpoint
export function handleLogout(req: Request, res: Response) {
  res.clearCookie('auth_token');
  res.json({ 
    success: true, 
    message: "Logged out successfully" 
  });
}

// Middleware to log device info for debugging (remove in production)
export function logDeviceInfo(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'development') {
    const fingerprint = generateDeviceFingerprint(req);
    console.log('Device Info:', {
      userAgent: fingerprint.userAgent,
      isIPhone: isIPhoneSafari(fingerprint.userAgent),
      fingerprint: fingerprint.fingerprint.substring(0, 16) + '...'
    });
  }
  next();
}
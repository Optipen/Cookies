import { SignJWT, jwtVerify } from 'jose';
import Cookies from 'js-cookie';

// JWT Configuration for production
const getJWTSecret = () => {
  const secretString = import.meta.env.VITE_JWT_SECRET || 'default-dev-secret-change-in-production-minimum-256-bits';
  return new TextEncoder().encode(secretString);
};

const JWT_CONFIG = {
  get secret() {
    return getJWTSecret();
  },
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'cookie-craze',
  audience: 'cookie-craze-users'
};

// Convert time string to seconds
function timeToSeconds(timeStr) {
  const unit = timeStr.slice(-1);
  const value = parseInt(timeStr.slice(0, -1));
  
  switch (unit) {
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return value;
  }
}

// Secure cookie configuration for production
const COOKIE_CONFIG = {
  httpOnly: false, // Note: Cannot be true in client-side React
  secure: import.meta.env.PROD, // Only in HTTPS in production
  sameSite: 'strict', // Prevent CSRF attacks
  path: '/',
  domain: import.meta.env.VITE_COOKIE_DOMAIN || undefined
};

// Cookie names
const TOKENS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  CSRF_TOKEN: 'csrf_token'
};

/**
 * Generate a JWT token with secure configuration
 */
export async function generateToken(payload, type = 'access') {
  const expiry = type === 'refresh' ? JWT_CONFIG.refreshTokenExpiry : JWT_CONFIG.accessTokenExpiry;
  const expirySeconds = timeToSeconds(expiry);
  
  try {
    const jwt = await new SignJWT({
      ...payload,
      type,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(JWT_CONFIG.issuer)
      .setAudience(JWT_CONFIG.audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expirySeconds)
      .sign(JWT_CONFIG.secret);
      
    return jwt;
  } catch (error) {
    console.error('[AUTH] Token generation failed:', error);
    throw error;
  }
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token, expectedType = 'access') {
  try {
    const { payload } = await jwtVerify(token, JWT_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });

    // Verify token type
    if (payload.type !== expectedType) {
      throw new Error(`Invalid token type. Expected ${expectedType}, got ${payload.type}`);
    }

    return payload;
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error.message);
    return null;
  }
}

/**
 * Set secure authentication cookies
 */
export function setAuthCookies(accessToken, refreshToken, csrfToken) {
  const cookieOptions = {
    ...COOKIE_CONFIG,
    expires: 7 // 7 days for refresh token
  };

  const accessCookieOptions = {
    ...COOKIE_CONFIG,
    expires: 1/96 // 15 minutes for access token
  };

  // Set tokens in cookies with appropriate expiration
  Cookies.set(TOKENS.ACCESS_TOKEN, accessToken, accessCookieOptions);
  Cookies.set(TOKENS.REFRESH_TOKEN, refreshToken, cookieOptions);
  
  if (csrfToken) {
    Cookies.set(TOKENS.CSRF_TOKEN, csrfToken, cookieOptions);
  }

  console.log('[AUTH] Authentication cookies set securely');
}

/**
 * Get authentication tokens from cookies
 */
export function getAuthTokens() {
  return {
    accessToken: Cookies.get(TOKENS.ACCESS_TOKEN),
    refreshToken: Cookies.get(TOKENS.REFRESH_TOKEN),
    csrfToken: Cookies.get(TOKENS.CSRF_TOKEN)
  };
}

/**
 * Clear all authentication cookies
 */
export function clearAuthCookies() {
  Cookies.remove(TOKENS.ACCESS_TOKEN, { path: COOKIE_CONFIG.path });
  Cookies.remove(TOKENS.REFRESH_TOKEN, { path: COOKIE_CONFIG.path });
  Cookies.remove(TOKENS.CSRF_TOKEN, { path: COOKIE_CONFIG.path });
  
  console.log('[AUTH] Authentication cookies cleared');
}

/**
 * Check if user is authenticated with valid tokens
 */
export async function isAuthenticated() {
  const { accessToken, refreshToken } = getAuthTokens();
  
  if (!accessToken && !refreshToken) {
    return false;
  }

  // Check access token validity
  if (accessToken && await verifyToken(accessToken, 'access')) {
    return true;
  }

  // If access token is invalid but refresh token exists, attempt refresh
  if (refreshToken && await verifyToken(refreshToken, 'refresh')) {
    return 'refresh_needed';
  }

  return false;
}

/**
 * Generate CSRF token for additional security
 */
export function generateCSRFToken() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken() {
  const { refreshToken } = getAuthTokens();
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const decoded = await verifyToken(refreshToken, 'refresh');
  if (!decoded) {
    throw new Error('Invalid refresh token');
  }

  // Generate new access token with same user data
  const newAccessToken = await generateToken({
    userId: decoded.userId,
    username: decoded.username,
    permissions: decoded.permissions
  }, 'access');

  // Update access token cookie
  const accessCookieOptions = {
    ...COOKIE_CONFIG,
    expires: 1/96 // 15 minutes
  };
  
  Cookies.set(TOKENS.ACCESS_TOKEN, newAccessToken, accessCookieOptions);
  
  console.log('[AUTH] Access token refreshed successfully');
  return newAccessToken;
}

/**
 * Create authenticated user session
 */
export async function createUserSession(userData) {
  const userId = userData.id || userData.userId || Date.now().toString();
  const username = userData.username || 'anonymous';
  const permissions = userData.permissions || ['game:play'];

  const tokenPayload = {
    userId,
    username,
    permissions,
    sessionId: generateCSRFToken().substring(0, 16)
  };

  const accessToken = await generateToken(tokenPayload, 'access');
  const refreshToken = await generateToken(tokenPayload, 'refresh');
  const csrfToken = generateCSRFToken();

  setAuthCookies(accessToken, refreshToken, csrfToken);

  return {
    user: tokenPayload,
    tokens: { accessToken, refreshToken, csrfToken }
  };
}

/**
 * Get current user from valid token
 */
export async function getCurrentUser() {
  const { accessToken } = getAuthTokens();
  
  if (!accessToken) {
    return null;
  }

  const decoded = await verifyToken(accessToken, 'access');
  if (!decoded) {
    return null;
  }

  return {
    userId: decoded.userId,
    username: decoded.username,
    permissions: decoded.permissions,
    sessionId: decoded.sessionId
  };
}

/**
 * Validate CSRF token for state-changing operations
 */
export function validateCSRFToken(providedToken) {
  const { csrfToken } = getAuthTokens();
  
  if (!csrfToken || !providedToken) {
    return false;
  }

  return csrfToken === providedToken;
}

/**
 * Secure logout - clear all authentication data
 */
export function logout() {
  clearAuthCookies();
  
  // Also clear any localStorage auth data as backup
  localStorage.removeItem('auth_backup');
  sessionStorage.removeItem('auth_temp');
  
  console.log('[AUTH] User logged out securely');
}

// Export token names for external use
export { TOKENS };
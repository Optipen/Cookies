import { describe, it, expect, beforeEach } from 'vitest';
import { generateToken, verifyToken, generateCSRFToken, validateCSRFToken } from '../utils/auth.js';

// Mock environment variables for testing
process.env.REACT_APP_JWT_SECRET = 'test-secret-key-for-testing-minimum-256-bits';

describe('JWT Authentication', () => {
  beforeEach(() => {
    // Clear any existing cookies/localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should generate and verify valid JWT tokens', async () => {
    const payload = {
      userId: 'test123',
      username: 'testuser',
      permissions: ['game:play', 'game:save']
    };

    // Generate access token
    const accessToken = await generateToken(payload, 'access');
    expect(accessToken).toBeDefined();
    expect(typeof accessToken).toBe('string');

    // Verify access token
    const decoded = await verifyToken(accessToken, 'access');
    expect(decoded).toBeDefined();
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.username).toBe(payload.username);
    expect(decoded.permissions).toEqual(payload.permissions);
    expect(decoded.type).toBe('access');
  });

  it('should generate different token types', async () => {
    const payload = {
      userId: 'test123',
      username: 'testuser',
      permissions: ['game:play']
    };

    const accessToken = await generateToken(payload, 'access');
    const refreshToken = await generateToken(payload, 'refresh');

    expect(accessToken).not.toBe(refreshToken);

    const accessDecoded = await verifyToken(accessToken, 'access');
    const refreshDecoded = await verifyToken(refreshToken, 'refresh');

    expect(accessDecoded.type).toBe('access');
    expect(refreshDecoded.type).toBe('refresh');
  });

  it('should reject tokens with wrong type', async () => {
    const payload = { userId: 'test123', username: 'testuser' };
    const accessToken = await generateToken(payload, 'access');

    // Try to verify access token as refresh token
    const result = await verifyToken(accessToken, 'refresh');
    expect(result).toBeNull();
  });

  it('should generate valid CSRF tokens', () => {
    const token1 = generateCSRFToken();
    const token2 = generateCSRFToken();

    expect(token1).toBeDefined();
    expect(token2).toBeDefined();
    expect(typeof token1).toBe('string');
    expect(typeof token2).toBe('string');
    expect(token1).not.toBe(token2); // Should be unique
    expect(token1.length).toBe(64); // 32 bytes * 2 hex chars
  });

  it('should validate CSRF tokens correctly', () => {
    // Mock the cookie getter
    const originalCookies = global.Cookies;
    global.Cookies = {
      get: (name) => {
        if (name === 'csrf_token') return 'valid-csrf-token';
        return null;
      }
    };

    const isValid = validateCSRFToken('valid-csrf-token');
    const isInvalid = validateCSRFToken('invalid-csrf-token');

    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);

    // Restore
    global.Cookies = originalCookies;
  });
});

describe('Token Security', () => {
  it('should reject malformed tokens', async () => {
    const malformedToken = 'not.a.valid.jwt.token';
    const result = await verifyToken(malformedToken, 'access');
    expect(result).toBeNull();
  });

  it('should reject tokens with invalid signature', async () => {
    // Generate a token with one secret
    const payload = { userId: 'test123', username: 'testuser' };
    const token = await generateToken(payload, 'access');

    // Try to verify with different secret (simulate tampering)
    const originalSecret = process.env.REACT_APP_JWT_SECRET;
    process.env.REACT_APP_JWT_SECRET = 'different-secret-key';

    const result = await verifyToken(token, 'access');
    expect(result).toBeNull();

    // Restore original secret
    process.env.REACT_APP_JWT_SECRET = originalSecret;
  });

  it('should include security claims in tokens', async () => {
    const payload = {
      userId: 'test123',
      username: 'testuser',
      permissions: ['game:play']
    };

    const token = await generateToken(payload, 'access');
    const decoded = await verifyToken(token, 'access');

    expect(decoded.iss).toBe('cookie-craze');
    expect(decoded.aud).toBe('cookie-craze-users');
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp > decoded.iat).toBe(true);
  });
});
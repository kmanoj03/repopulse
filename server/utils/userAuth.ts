import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

export interface UserJWTPayload {
  userId: string;
  githubId: number;
  username: string;
  installationId: number;
  iat?: number;
  exp?: number;
}

/**
 * Generate user authentication JWT
 * This is for YOUR app, not GitHub API
 */
export function generateUserJWT(payload: Omit<UserJWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify user JWT
 */
export function verifyUserJWT(token: string): UserJWTPayload {
  return jwt.verify(token, JWT_SECRET) as UserJWTPayload;
}


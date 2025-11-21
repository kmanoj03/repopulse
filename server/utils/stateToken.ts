import jwt from 'jsonwebtoken';

const STATE_JWT_SECRET = process.env.APP_STATE_JWT_SECRET || process.env.JWT_SECRET || 'your-state-secret-key';
const STATE_TOKEN_EXPIRY = '15m'; // 15 minutes

export interface StatePayload {
  userId: string;
  purpose: 'github_app_install';
}

/**
 * Sign a state token for GitHub App installation flow
 * Used to verify the callback came from our own redirect
 */
export function signState(payload: StatePayload): string {
  return jwt.sign(payload, STATE_JWT_SECRET, {
    expiresIn: STATE_TOKEN_EXPIRY,
  });
}

/**
 * Verify and decode a state token
 * Throws error if token is invalid or expired
 */
export function verifyState(token: string): StatePayload {
  try {
    const decoded = jwt.verify(token, STATE_JWT_SECRET) as StatePayload;
    
    // Validate purpose
    if (decoded.purpose !== 'github_app_install') {
      throw new Error('Invalid state token purpose');
    }
    
    return decoded;
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid state token');
    }
    if (error.name === 'TokenExpiredError') {
      throw new Error('State token expired');
    }
    throw error;
  }
}


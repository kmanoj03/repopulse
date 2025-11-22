import jwt from 'jsonwebtoken';

/**
 * Test file with issues similar to userAuth.ts
 * Issues: Missing validation, hardcoded secrets, missing error handling
 */
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

// Issue: No validation that JWT_SECRET is strong enough
// Issue: Hardcoded fallback secret is insecure

/**
 * Test function with missing input validation
 */
export function testGenerateUserJWT(payload: any): string {
  // Issue: No validation of payload structure
  // Issue: Using 'any' type instead of proper interface
  // Issue: No check if required fields exist
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d', // Issue: Hardcoded expiry
  });
}

/**
 * Test function with missing error handling
 */
export function testVerifyUserJWT(token: string): any {
  // Issue: No validation that token is a string
  // Issue: No error handling for invalid tokens
  // Issue: Using 'any' return type instead of proper type
  
  // Issue: No try-catch - will throw if token is invalid
  const decoded = jwt.verify(token, JWT_SECRET);
  
  // Issue: Type assertion without validation
  return decoded as any;
}

/**
 * Test function with missing null checks
 */
export function testDecodeToken(token: string): { userId: string; username: string } {
  // Issue: No validation of token format
  // Issue: No error handling
  const decoded = jwt.decode(token) as any;
  
  // Issue: Accessing properties without null check
  const userId = decoded.userId;
  const username = decoded.username;
  
  // Issue: No validation that userId and username exist
  return {
    userId,
    username,
  };
}

/**
 * Test function with security issues
 */
export function testGetUserFromToken(token: string): any {
  // Issue: No validation
  // Issue: No error handling
  // Issue: Exposing full decoded token
  const decoded = jwt.verify(token, JWT_SECRET);
  
  // Issue: Returning full decoded object might expose sensitive data
  return decoded;
}

/**
 * Test function with missing environment variable check
 */
export function testValidateJWTConfig(): boolean {
  // Issue: Only checks if secret exists, not if it's secure
  const hasSecret = !!process.env.JWT_SECRET;
  
  // Issue: No validation of secret strength
  // Issue: No check for default/weak secrets
  return hasSecret;
}


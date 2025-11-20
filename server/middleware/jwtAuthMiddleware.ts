import { Request, Response, NextFunction } from 'express';
import { verifyUserJWT } from '../utils/userAuth';

/**
 * Middleware to authenticate requests using JWT
 * Extracts and verifies the JWT token from Authorization header
 */
export async function jwtAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7); // Remove "Bearer "
    
    // Verify token
    const decoded = verifyUserJWT(token);
    
    // Attach user info to request
    (req as any).user = {
      userId: decoded.userId,
      githubId: decoded.githubId,
      username: decoded.username,
      installationId: decoded.installationId,
    };
    
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
}


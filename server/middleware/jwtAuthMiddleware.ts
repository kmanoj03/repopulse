import { Request, Response, NextFunction } from 'express';
import { verifyUserJWT } from '../utils/userAuth';
import { getUserModel, IUser } from '../models/User';

/**
 * Middleware to authenticate requests using JWT
 * Extracts and verifies the JWT token from Authorization header
 * Loads full user document from database and attaches to req.user
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
    
    // Load full user from database
    const User = getUserModel();
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Attach full user document to request
    (req as any).user = user;
    
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


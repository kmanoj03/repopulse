import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../config/auth";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      const payload = verifyAccessToken(token);
      req.user = {
        id: payload.userId,
        role: payload.role,
      };
      next();
    } catch (error) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }

  next();
}


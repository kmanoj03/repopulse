// Ensure environment variables are loaded
import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  role: string;
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ACCESS_EXPIRES_IN: string = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

// TypeScript type narrowing: after the check above, this is guaranteed to be a string
const SECRET = JWT_SECRET as string;

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, SECRET) as JwtPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Access token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid access token");
    }
    throw error;
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, SECRET) as JwtPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Refresh token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
}


import { Request, Response } from "express";
import { z } from "zod";
import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../config/auth";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

// Validation schemas
export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").trim(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// POST /auth/signup
export async function handleSignup(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body
    const validationResult = signupSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: validationResult.error.errors[0].message,
      });
      return;
    }

    const { email, password, name } = validationResult.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = new User({
      email,
      passwordHash,
      name,
      role: "user",
    });

    await user.save();

    // Generate tokens
    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });
    const refreshToken = signRefreshToken({
      userId: user._id.toString(),
      role: user.role,
    });

    // Return user (without passwordHash) and tokens
    res.status(201).json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// POST /auth/login
export async function handleLogin(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: validationResult.error.errors[0].message,
      });
      return;
    }

    const { email, password } = validationResult.data;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Generate tokens
    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });
    const refreshToken = signRefreshToken({
      userId: user._id.toString(),
      role: user.role,
    });

    // Return user (without passwordHash) and tokens
    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// POST /auth/refresh
export async function handleRefresh(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body
    const validationResult = refreshSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: validationResult.error.errors[0].message,
      });
      return;
    }

    const { refreshToken } = validationResult.data;

    // Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    // Verify user still exists
    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Generate new tokens
    const newAccessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });
    const newRefreshToken = signRefreshToken({
      userId: user._id.toString(),
      role: user.role,
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /auth/me
export async function handleGetMe(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}


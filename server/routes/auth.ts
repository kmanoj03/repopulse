import express from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  handleSignup,
  handleLogin,
  handleRefresh,
  handleGetMe,
} from "../handlers/authHandler";

const router = express.Router();

// POST /auth/signup
router.post("/signup", handleSignup);

// POST /auth/login
router.post("/login", handleLogin);

// POST /auth/refresh
router.post("/refresh", handleRefresh);

// GET /auth/me
router.get("/me", authMiddleware, handleGetMe);

export default router;


import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import webhookRoutes from "./routes/route";
import githubAuthRoutes from "./routes/githubAuth";
import prRoutes from "./routes/prRoutes";
import { printEnvValidation } from "./utils/validateEnv";

// Load environment variables from .env file
dotenv.config();

// Validate environment variables
if (!printEnvValidation()) {
  console.error('Server startup failed: Missing required environment variables');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE SETUP
// ============================================

// CORS - Allow frontend to call this API
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// IMPORTANT: Use RAW body parser for webhook route (needed for signature verification)
// GitHub sends the payload as raw bytes, and we need to verify HMAC signature
app.use("/webhooks/github", express.raw({ type: "application/json" }));

// Regular JSON parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// DATABASE CONNECTION
// ============================================

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/repopulse";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

// ============================================
// ROUTES
// ============================================

// Webhook routes - GitHub will POST to /webhooks/github
app.use("/webhooks", webhookRoutes);

// GitHub OAuth routes
app.use("/auth", githubAuthRoutes);

// PR API routes (protected by JWT)
app.use("/api", prRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Root endpoint - just a welcome message
app.get("/", (req, res) => {
  res.json({
    message: "RepoPulse API Server",
    version: "1.0.0",
    endpoints: {
      webhooks: "/webhooks/github",
      auth: "/auth/github",
      api: "/api/prs",
      health: "/health",
    },
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log("═══════════════════════════════════════");
  console.log(`RepoPulse Server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhooks/github`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
  console.log("═══════════════════════════════════════");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  mongoose.connection.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  mongoose.connection.close();
  process.exit(0);
});

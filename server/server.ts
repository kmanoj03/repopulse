import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import webhookRoutes, { handleWebhook } from "./routes/route";
import githubAuthRoutes from "./routes/githubAuth";
import prRoutes from "./routes/prRoutes";
import meRoutes from "./routes/meRoutes";
import githubAppRoutes from "./routes/githubAppRoutes";
import { printEnvValidation } from "./utils/validateEnv";
import { assertSlackConfig } from "./config/slackConfig";

// Load environment variables from .env file
dotenv.config();

// Validate environment variables
if (!printEnvValidation()) {
  console.error('Server startup failed: Missing required environment variables');
  process.exit(1);
}

// Validate Slack configuration
try {
  assertSlackConfig();
  console.log('✅ Slack configuration validated');
} catch (error) {
  console.error('❌ Slack configuration error:', (error as Error).message);
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

// IMPORTANT: Use RAW body parser for webhook routes (needed for signature verification)
// GitHub sends the payload as raw bytes, and we need to verify HMAC signature
// Apply raw body parser conditionally - only for POST / and /webhooks/github
app.use((req, res, next) => {
  if (req.method === 'POST' && (req.path === '/' || req.path === '/webhooks/github')) {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    next();
  }
});

// Regular JSON parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global request logger (for debugging) - log ALL requests to /api/github/app/setup
app.use((req, res, next) => {
  if (req.path.includes('/api/github/app/setup')) {
    console.log('🔍🔍🔍 GLOBAL MIDDLEWARE: Request to', req.method, req.path);
    console.log('   Original URL:', req.originalUrl);
    console.log('   Host:', req.get('host'));
    console.log('   Headers:', JSON.stringify(req.headers, null, 2));
    console.log('   Query:', req.query);
  }
  next();
});

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

// Handle webhooks at root path (/) - GitHub App webhook URL might point here
app.post("/", async (req, res) => {
  // Check if this looks like a GitHub webhook
  const signature = req.headers['x-hub-signature-256'] as string;
  const event = req.headers['x-github-event'] as string;
  
  if (signature && event) {
    // This is a GitHub webhook, handle it
    console.log('📥 GitHub webhook received at root path (/)');
    return handleWebhook(req, res);
  } else {
    // Not a webhook, return 404
    return res.status(404).json({ error: 'Not found' });
  }
});

// Webhook routes - GitHub will POST to /webhooks/github
app.use("/webhooks", webhookRoutes);

// GitHub OAuth routes
app.use("/auth", githubAuthRoutes);

// PUBLIC GitHub App callback routes (must be defined BEFORE other /api routes)
// These routes do NOT require authentication - GitHub redirects here after installation
// IMPORTANT: Define these routes directly on the app, not in a router, to avoid auth middleware

// Test endpoint - public, no auth required
app.get("/api/github/app/setup/test", (req, res, next) => {
  console.log('🔵🔵🔵 TEST ENDPOINT HIT: /api/github/app/setup/test');
  console.log('   Method:', req.method);
  console.log('   Path:', req.path);
  console.log('   Original URL:', req.originalUrl);
  console.log('   Query:', req.query);
  
  const APP_BASE_URL = process.env.APP_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3000';
  const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  
  res.json({
    message: "✅ GitHub App callback route is accessible (no auth required)",
    timestamp: new Date().toISOString(),
    environment: {
      APP_BASE_URL,
      FRONTEND_BASE_URL,
      isLocalhost: APP_BASE_URL.includes('localhost') || APP_BASE_URL.includes('127.0.0.1'),
    },
    warning: APP_BASE_URL.includes('localhost') || APP_BASE_URL.includes('127.0.0.1')
      ? "⚠️ APP_BASE_URL is set to localhost - GitHub cannot redirect to localhost! You need to use ngrok or another public URL."
      : "✅ APP_BASE_URL looks good",
    query: req.query,
    note: "This endpoint is public and doesn't require authentication. Use this to test if your ngrok tunnel is working.",
  });
});

// Main callback endpoint - public, no auth required
app.get("/api/github/app/setup", async (req, res) => {
  console.log('🔵🔵🔵 CALLBACK ROUTE HIT: /api/github/app/setup');
  console.log('   Method:', req.method);
  console.log('   Query:', req.query);
  const { handleAppSetup } = await import('./handlers/githubAppHandler');
  return handleAppSetup(req, res);
});

// GitHub App routes (other endpoints that require auth)
app.use("/api", githubAppRoutes);

// PR API routes (protected by JWT)
app.use("/api", prRoutes);

// Me API routes (protected by JWT)
app.use("/api", meRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Debug endpoint to check PR/User installation mismatch
app.get("/api/debug/installations", async (req, res) => {
  try {
    const { getInstallationModel } = await import('./models/Installation');
    const { getUserModel } = await import('./models/User');
    const { getPullRequestModel } = await import('./models/pullRequest.model');
    
    const Installation = getInstallationModel();
    const User = getUserModel();
    const PullRequest = getPullRequestModel();
    
    const installations = await Installation.find({}).lean();
    const users = await User.find({}).select('username installationIds').lean();
    const prs = await PullRequest.find({}).select('installationId repoFullName number title').limit(10).lean();
    
    const prInstallationIds = [...new Set(prs.map((p: any) => p.installationId))];
    
    res.json({
      installations: installations.map((i: any) => ({
        id: i.installationId,
        account: i.accountLogin,
        repos: i.repositories.length,
      })),
      users: users.map((u: any) => ({
        username: u.username,
        installationIds: u.installationIds || [],
      })),
      prs: {
        count: await PullRequest.countDocuments({}),
        sample: prs,
        installationIds: prInstallationIds,
      },
      analysis: {
        issue: "PRs have installationIds that might not match user's installationIds",
        recommendation: "Ensure user's installationIds array includes all installation IDs from PRs",
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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
      callbackTest: "/api/github/app/setup/test",
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
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Public test endpoint: http://localhost:${PORT}/api/github/app/setup/test`);
  console.log(`GitHub App callback: http://localhost:${PORT}/api/github/app/setup`);
  console.log("═══════════════════════════════════════");
  console.log("🔵 Registered public routes (no auth required):");
  console.log("   GET /api/github/app/setup");
  console.log("   GET /api/github/app/setup/test");
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

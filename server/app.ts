import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Auth routes
app.use("/auth", authRoutes);

// Protected API routes will be added here later
// app.use("/api/prs", authMiddleware, prRoutes);

export default app;


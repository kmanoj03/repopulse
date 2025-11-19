import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import webhookRoutes from './routes/route';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE SETUP
// ============================================

// CORS - Allow frontend to call this API
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// IMPORTANT: Use RAW body parser for webhook route (needed for signature verification)
// GitHub sends the payload as raw bytes, and we need to verify HMAC signature
app.use('/webhooks/github', express.raw({ type: 'application/json' }));

// Regular JSON parser for all other routes
app.use(express.json());

// ============================================
// DATABASE CONNECTION
// ============================================

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/repopulse')
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log(`📦 Database: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // Exit if can't connect to database
  });

// ============================================
// ROUTES
// ============================================

// Webhook routes - GitHub will POST to /webhooks/github
app.use('/webhooks', webhookRoutes);

// Health check endpoint - useful for monitoring and Docker health checks
app.get('/healthz', async (req, res) => {
  try {
    // Check if database connection exists and is ready
    if (!mongoose.connection.db) {
      return res.status(503).json({ 
        status: 'error', 
        mongo: 'not connected',
        timestamp: new Date().toISOString()
      });
    }
    
    // Ping MongoDB to ensure it's responsive
    await mongoose.connection.db.admin().ping();
    res.json({ 
      status: 'ok', 
      mongo: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      mongo: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint - just a welcome message
app.get('/', (req, res) => {
  res.json({ 
    message: 'RepoPulse API Server',
    version: '1.0.0',
    endpoints: {
      webhooks: '/webhooks/github',
      health: '/healthz'
    }
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('🚀 ═══════════════════════════════════════');
  console.log(`🚀 RepoPulse Server running on port ${PORT}`);
  console.log(`🚀 Webhook endpoint: http://localhost:${PORT}/webhooks/github`);
  console.log(`🚀 Health check: http://localhost:${PORT}/healthz`);
  console.log('🚀 ═══════════════════════════════════════');
});



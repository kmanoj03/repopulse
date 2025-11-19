import express from 'express';
import { handleGitHubWebhook } from '../handlers/handler';

const router = express.Router();

// ============================================
// GITHUB WEBHOOK ENDPOINT
// ============================================

// POST /webhooks/github
// This is where GitHub sends webhook events when PR activity happens
// Events: pull_request.opened, pull_request.closed, pull_request.synchronize, etc.
router.post('/github', handleGitHubWebhook);

// Optional: GET endpoint to test if webhook route is working
router.get('/github', (req, res) => {
  res.json({ 
    message: 'GitHub webhook endpoint is active',
    method: 'POST',
    note: 'This endpoint receives webhooks from GitHub App'
  });
});

export default router;



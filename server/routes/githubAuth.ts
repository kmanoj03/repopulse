import express from 'express';
import {
  handleGitHubLogin,
  handleGitHubCallback,
  handleSwitchInstallation,
} from '../handlers/githubAuthHandler';
import { jwtAuthMiddleware } from '../middleware/jwtAuthMiddleware';

const router = express.Router();

// GET /auth/github
// Redirects to GitHub OAuth page
router.get('/github', handleGitHubLogin);

// GET /auth/github/callback
// Handles callback from GitHub OAuth
router.get('/github/callback', handleGitHubCallback);

// POST /auth/switch-installation
// Switch between installations (requires JWT)
router.post('/switch-installation', jwtAuthMiddleware, handleSwitchInstallation);

export default router;


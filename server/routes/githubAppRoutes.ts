import express from 'express';
import { getInstallUrl } from '../handlers/githubAppHandler';
import { jwtAuthMiddleware } from '../middleware/jwtAuthMiddleware';

const router = express.Router();

// POST /api/github/app/install-url - Generate install URL
// NOTE: This route requires authentication (user must be logged in)
router.post('/github/app/install-url', jwtAuthMiddleware, getInstallUrl);

// NOTE: The /setup and /setup/test routes are now defined directly in server.ts
// to ensure they're registered BEFORE other /api routes and don't require auth

export default router;


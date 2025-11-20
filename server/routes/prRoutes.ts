import express from 'express';
import {
  getUserPRs,
  getPRDetail,
  getUserRepositories,
  regeneratePRSummary,
} from '../handlers/prHandler';
import { jwtAuthMiddleware } from '../middleware/jwtAuthMiddleware';

const router = express.Router();

// All PR routes require authentication
router.use(jwtAuthMiddleware);

// GET /api/prs
// Get all PRs for user's current installation
router.get('/prs', getUserPRs);

// GET /api/prs/:id
// Get single PR by ID
router.get('/prs/:id', getPRDetail);

// GET /api/repositories
// Get list of repositories for user's installation
router.get('/repositories', getUserRepositories);

// POST /api/prs/:id/regenerate
// Regenerate PR summary
router.post('/prs/:id/regenerate', regeneratePRSummary);

export default router;


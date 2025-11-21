import express from 'express';
import { getMe } from '../handlers/meHandler';
import { jwtAuthMiddleware } from '../middleware/jwtAuthMiddleware';

const router = express.Router();

// GET /api/me - Get current user info
router.get('/me', jwtAuthMiddleware, getMe);

export default router;


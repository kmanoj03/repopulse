import { Request, Response } from 'express';

/**
 * GET /api/me
 * Returns current user information and installation status
 * Requires authentication via jwtAuthMiddleware
 */
export async function getMe(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Ensure installationIds is an array
    const installationIds = Array.isArray(user.installationIds) ? user.installationIds : [];
    const hasInstallations = installationIds.length > 0;

    console.log(`📊 getMe: User ${user.username}, Installations: [${installationIds.join(', ')}], hasInstallations: ${hasInstallations}`);

    return res.json({
      user: {
        id: user._id.toString(),
        githubId: user.githubId,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        installationIds,
      },
      hasInstallations,
    });
  } catch (error) {
    console.error('❌ Error in getMe:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


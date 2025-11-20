import { Request, Response } from 'express';
import { getPullRequestModel } from '../models/pullRequest.model';
import { getInstallationModel } from '../models/Installation';
import { getUserModel } from '../models/User';

/**
 * GET /api/prs
 * Get all PRs for ALL of the authenticated user's installations
 */
export async function getUserPRs(req: Request, res: Response) {
  try {
    // req.user comes from JWT middleware
    const { userId } = (req as any).user;
    
    // Look up user to get ALL their installation IDs
    const User = getUserModel();
    const user = await User.findById(userId);
    
    if (!user || !user.installationIds || user.installationIds.length === 0) {
      return res.json({
        success: true,
        data: {
          repositories: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }
    
    const { status, page = 1, limit = 20, repoId } = req.query;
    
    // Build filter - query PRs from ALL user's installations
    const filter: any = {
      installationId: { $in: user.installationIds },
    };
    
    if (status) filter.status = status;
    if (repoId) filter.repoId = repoId;
    
    const PullRequest = getPullRequestModel();
    
    // Query PRs
    const [prs, total] = await Promise.all([
      PullRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      PullRequest.countDocuments(filter),
    ]);
    
    // Group by repo
    const grouped = prs.reduce((acc: any, pr) => {
      const key = pr.repoFullName;
      if (!acc[key]) {
        acc[key] = { repoFullName: key, repoId: pr.repoId, prs: [] };
      }
      acc[key].prs.push(pr);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        repositories: Object.values(grouped),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching PRs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/prs/:id
 * Get a single PR by ID
 */
export async function getPRDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { userId } = (req as any).user;
    
    // Look up user to get ALL their installation IDs
    const User = getUserModel();
    const user = await User.findById(userId);
    
    if (!user || !user.installationIds || user.installationIds.length === 0) {
      return res.status(403).json({ error: 'No installations found' });
    }
    
    const PullRequest = getPullRequestModel();
    
    const pr = await PullRequest.findOne({
      _id: id,
      installationId: { $in: user.installationIds }, // Security: only show PR from user's installations
    });
    
    if (!pr) {
      return res.status(404).json({ error: 'PR not found' });
    }
    
    res.json({
      success: true,
      data: pr,
    });
  } catch (error) {
    console.error('Error fetching PR:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/repositories
 * Get list of repositories for the user's current installation
 */
export async function getUserRepositories(req: Request, res: Response) {
  try {
    const { installationId } = (req as any).user;
    
    const Installation = getInstallationModel();
    
    // Get installation
    const installation = await Installation.findOne({
      installationId,
      suspendedAt: null,
    });
    
    if (!installation) {
      return res.status(404).json({ error: 'Installation not found' });
    }
    
    const PullRequest = getPullRequestModel();
    
    // Get PR counts for each repo
    const repoCounts = await Promise.all(
      installation.repositories.map(async (repo) => {
        const count = await PullRequest.countDocuments({
          installationId,
          repoId: repo.repoId,
        });
        return {
          repoId: repo.repoId,
          repoFullName: repo.repoFullName,
          private: repo.private,
          prCount: count,
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        repositories: repoCounts,
        total: repoCounts.length,
      },
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/prs/:id/regenerate
 * Regenerate summary for a PR (placeholder for future AI integration)
 */
export async function regeneratePRSummary(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { installationId, userId } = (req as any).user;
    
    const PullRequest = getPullRequestModel();
    
    const pr = await PullRequest.findOne({
      _id: id,
      installationId,
    });
    
    if (!pr) {
      return res.status(404).json({ error: 'PR not found' });
    }
    
    // Update userId to track who triggered regeneration
    pr.userId = userId;
    pr.summary = {
      tldr: 'Regenerating summary...',
      risks: [],
      labels: [],
      createdAt: new Date(),
    };
    
    await pr.save();
    
    console.log(`🔄 PR ${pr.repoFullName}#${pr.number} queued for regeneration by user ${userId}`);
    
    // TODO: Enqueue for AI analysis
    
    res.json({
      success: true,
      message: 'PR summary regeneration queued',
      data: pr,
    });
  } catch (error) {
    console.error('Error regenerating PR summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


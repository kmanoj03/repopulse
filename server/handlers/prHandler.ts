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
    // req.user comes from JWT middleware (now loads full user from DB)
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // User object from middleware should already have installationIds
    // But if empty, try to find installations that might belong to this user
    const Installation = getInstallationModel();
    
    if (!user.installationIds || user.installationIds.length === 0) {
      console.log(`📊 getUserPRs: User ${user.username} has no installations in their array`);
      console.log(`   Attempting to find installations by username match...`);
      
      // Try to find installations that match this user's GitHub username
      const matchingInstallations = await Installation.find({
        accountLogin: user.username,
        suspendedAt: null,
      }).lean();
      
      if (matchingInstallations.length > 0) {
        const foundIds = matchingInstallations.map((i: any) => i.installationId);
        console.log(`   Found ${matchingInstallations.length} installations matching username: [${foundIds.join(', ')}]`);
        console.log(`   Updating user's installationIds...`);
        
        // Update user with found installations
        user.installationIds = foundIds;
        await user.save();
        console.log(`   ✅ User ${user.username} now has installationIds: [${foundIds.join(', ')}]`);
      } else {
        console.log(`   ⚠️  No installations found for username "${user.username}"`);
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
    }
    
    // Also check if user has installationIds but they don't match any PRs
    // This handles the case where PRs exist but user's installationIds are wrong
    const PullRequest = getPullRequestModel();
    const prsWithUserInstallations = await PullRequest.countDocuments({
      installationId: { $in: user.installationIds },
    });
    
    if (prsWithUserInstallations === 0 && user.installationIds.length > 0) {
      console.log(`   ⚠️  User has installationIds [${user.installationIds.join(', ')}] but no PRs found with those IDs`);
      console.log(`   Checking for PRs with different installationIds...`);
      
      // Find all PRs and their installationIds
      const allPRs = await PullRequest.find({}).limit(10).lean();
      if (allPRs.length > 0) {
        const prInstallationIds = [...new Set(allPRs.map((p: any) => p.installationId))];
        console.log(`   Found PRs with installationIds: [${prInstallationIds.join(', ')}]`);
        
        // Try to find installations by username that match PR installationIds
        const matchingInstallations = await Installation.find({
          accountLogin: user.username,
          installationId: { $in: prInstallationIds },
          suspendedAt: null,
        }).lean();
        
        if (matchingInstallations.length > 0) {
          const correctIds = matchingInstallations.map((i: any) => i.installationId);
          console.log(`   🔧 Auto-fixing: Found correct installationIds [${correctIds.join(', ')}] for user ${user.username}`);
          user.installationIds = correctIds;
          await user.save();
          console.log(`   ✅ User ${user.username} updated with correct installationIds: [${correctIds.join(', ')}]`);
        }
      }
    }
    
    const { status, page = 1, limit = 20, repoId, q } = req.query;
    
    // Build filter - query PRs from ALL user's installations
    const filter: any = {
      installationId: { $in: user.installationIds },
    };
    
    if (status) filter.status = status;
    if (repoId) filter.repoId = repoId;
    
    // Text search if provided
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { author: { $regex: q, $options: 'i' } },
        { repoFullName: { $regex: q, $options: 'i' } },
      ];
    }
    
    console.log(`📊 getUserPRs: Querying PRs for user ${user.username}`);
    console.log(`   User InstallationIds: [${user.installationIds.join(', ')}]`);
    console.log(`   Filter:`, JSON.stringify(filter, null, 2));
    
    // Query PRs
    const [prs, total] = await Promise.all([
      PullRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      PullRequest.countDocuments(filter),
    ]);
    
    console.log(`📊 Found ${prs.length} PRs (total: ${total})`);
    if (prs.length > 0) {
      console.log(`   Sample PRs: ${prs.slice(0, 3).map((p: any) => `${p.repoFullName}#${p.number} (inst: ${p.installationId})`).join(', ')}`);
    } else {
      // Debug: Check what PRs exist and what installationIds they have
      const allPRs = await PullRequest.find({}).limit(5).lean();
      if (allPRs.length > 0) {
        const prInstallationIds = [...new Set(allPRs.map((p: any) => p.installationId))];
        console.log(`   ⚠️  No PRs found, but there are ${allPRs.length} PRs in DB`);
        console.log(`   PRs have installationIds: [${prInstallationIds.join(', ')}]`);
        console.log(`   User has installationIds: [${user.installationIds.join(', ')}]`);
        console.log(`   🔍 MISMATCH: User's installationIds don't match PR installationIds!`);
        
        // Try to auto-fix: find installations by username and add missing ones
        const Installation = getInstallationModel();
        const matchingInstallations = await Installation.find({
          accountLogin: user.username,
          installationId: { $in: prInstallationIds },
          suspendedAt: null,
        }).lean();
        
        if (matchingInstallations.length > 0) {
          const missingIds = matchingInstallations
            .map((i: any) => i.installationId)
            .filter((id: number) => !user.installationIds.includes(id));
          
          if (missingIds.length > 0) {
            console.log(`   🔧 Auto-fixing: Adding missing installationIds [${missingIds.join(', ')}] to user`);
            user.installationIds.push(...missingIds);
            await user.save();
            console.log(`   ✅ User ${user.username} now has installationIds: [${user.installationIds.join(', ')}]`);
            
            // Retry the query with updated installationIds
            const updatedFilter = {
              ...filter,
              installationId: { $in: user.installationIds },
            };
            const [retryPRs, retryTotal] = await Promise.all([
              PullRequest.find(updatedFilter)
                .sort({ createdAt: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit))
                .lean(),
              PullRequest.countDocuments(updatedFilter),
            ]);
            
            console.log(`   🔄 Retry query found ${retryPRs.length} PRs (total: ${retryTotal})`);
            
            // Use the retry results
            const grouped = retryPRs.reduce((acc: any, pr) => {
              const key = pr.repoFullName;
              if (!acc[key]) {
                acc[key] = { repoFullName: key, repoId: pr.repoId, prs: [] };
              }
              acc[key].prs.push(pr);
              return acc;
            }, {});
            
            return res.json({
              success: true,
              data: {
                repositories: Object.values(grouped),
                pagination: {
                  page: Number(page),
                  limit: Number(limit),
                  total: retryTotal,
                  totalPages: Math.ceil(retryTotal / Number(limit)),
                },
              },
            });
          }
        }
      }
    }
    
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
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!user.installationIds || user.installationIds.length === 0) {
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


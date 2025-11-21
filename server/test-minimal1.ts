import { Request, Response } from 'express';
import { getPullRequestModel } from './models/pullRequest.model';

/**
 * Test file with minimal issues - low risk score
 * Issues: Minor type issues, subtle missing checks
 */
export async function testGetPRs(req: Request, res: Response) {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { page = 1, limit = 20 } = req.query;
    
    // Minor issue: page and limit are strings from query, should be converted
    const pageNum = Number(page);
    const limitNum = Number(limit);
    
    const PullRequest = getPullRequestModel();
    
    const filter: any = {
      installationId: { $in: user.installationIds || [] },
    };
    
    const prs = await PullRequest.find(filter)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    
    // Minor issue: Using array length instead of countDocuments for total
    // This works but is not accurate for pagination
    const total = prs.length;
    
    res.json({
      success: true,
      data: {
        prs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching PRs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


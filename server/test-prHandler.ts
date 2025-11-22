import { Request, Response } from 'express';
import { getPullRequestModel } from './models/pullRequest.model';
import { getUserModel } from './models/User';
import { prSummaryQueue } from './queues/prSummaryQueue';

/**
 * Test file with issues similar to prHandler.ts
 * Issues: Missing null checks, type assertions, missing error handling
 */
export async function testGetUserPRs(req: Request, res: Response) {
  try {
    const user = req.user;
    
    // Issue: No null check before accessing user properties
    const installationIds = user.installationIds;
    
    // Issue: Type assertion without validation
    const { page, limit, status } = req.query as any;
    
    // Issue: Missing validation - page and limit could be strings or undefined
    const skip = (page - 1) * limit;
    
    const PullRequest = getPullRequestModel();
    
    // Issue: No error handling if filter is invalid
    const filter: any = {
      installationId: { $in: installationIds },
    };
    
    if (status) {
      filter.status = status;
    }
    
    // Issue: Missing null check - prs could be null
    const prs = await PullRequest.find(filter)
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Issue: Accessing properties without checking if prs is empty
    const firstPR = prs[0];
    const repoName = firstPR.repoFullName;
    
    // Issue: Missing error handling for grouping operation
    const grouped = prs.reduce((acc: any, pr) => {
      const key = pr.repoFullName;
      // Issue: No check if acc[key] exists before accessing
      acc[key].prs.push(pr);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        repositories: Object.values(grouped),
        pagination: {
          page,
          limit,
          total: prs.length, // Issue: Should use countDocuments, not array length
        },
      },
    });
  } catch (error) {
    // Issue: Generic error handling, no specific error types
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Test function with missing environment variable checks
 */
export async function testGetPRDetail(req: Request, res: Response) {
  // Issue: Hardcoded default value, no validation
  const API_KEY = process.env.API_KEY || 'default-key';
  
  // Issue: Using API_KEY without checking if it's actually set
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
  };
  
  const { id } = req.params;
  
  // Issue: No validation that id is a valid MongoDB ObjectId
  const PullRequest = getPullRequestModel();
  const pr = await PullRequest.findById(id);
  
  // Issue: Accessing properties without null check
  const summary = pr.summary.tldr;
  const risks = pr.summary.risks;
  
  // Issue: No check if risks array exists before mapping
  const riskLabels = risks.map(r => r.toUpperCase());
  
  res.json({
    success: true,
    data: {
      ...pr,
      summaryText: summary,
      riskLabels,
    },
  });
}

/**
 * Test function with unused variables and missing type guards
 */
export async function testRegenerateSummary(req: Request, res: Response) {
  const { id } = req.params;
  const user = req.user;
  
  // Issue: Unused variable
  const userId = user._id;
  const username = user.username;
  const email = user.email; // Issue: email might not exist on user object
  
  // Issue: No type guard - assuming user has installationIds
  const hasAccess = user.installationIds.includes(12345);
  
  const PullRequest = getPullRequestModel();
  const pr = await PullRequest.findById(id);
  
  // Issue: No null check before accessing pr properties
  pr.summary = null;
  pr.summaryStatus = 'pending';
  
  // Issue: Missing await - save() returns a promise
  pr.save();
  
  // Issue: Accessing property that might not exist
  const queueName = process.env.QUEUE_NAME;
  const job = await prSummaryQueue.add(queueName, {
    pullRequestId: pr._id.toString(),
  });
  
  res.json({ success: true });
}


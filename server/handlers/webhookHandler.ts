import { Request, Response } from 'express';
import { getInstallationModel } from '../models/Installation';
import { getPullRequestModel } from '../models/pullRequest.model';
import { getPRFiles } from '../utils/githubAppAuth';

// ============================================
// INSTALLATION WEBHOOKS
// ============================================

/**
 * Handle installation.created event
 * Triggered when someone installs the GitHub App
 */
export async function handleInstallationCreated(req: Request, res: Response) {
  const { installation, repositories } = req.body;
  
  try {
    const Installation = getInstallationModel();
    
    // Save installation
    await Installation.create({
      installationId: installation.id,
      accountType: installation.account.type,
      accountLogin: installation.account.login,
      accountAvatarUrl: installation.account.avatar_url || '',
      repositories: repositories.map((repo: any) => ({
        repoId: repo.id.toString(),
        repoFullName: repo.full_name,
        private: repo.private,
        installedAt: new Date(),
      })),
    });
    
    console.log(`✅ Installation ${installation.id} created for ${installation.account.login}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving installation:', error);
    res.status(500).json({ error: 'Failed to save installation' });
  }
}

/**
 * Handle installation.deleted event
 * Triggered when someone uninstalls the GitHub App
 */
export async function handleInstallationDeleted(req: Request, res: Response) {
  const { installation } = req.body;
  
  try {
    const Installation = getInstallationModel();
    
    // Mark installation as suspended
    await Installation.findOneAndUpdate(
      { installationId: installation.id },
      { suspendedAt: new Date() }
    );
    
    console.log(`✅ Installation ${installation.id} marked as deleted`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting installation:', error);
    res.status(500).json({ error: 'Failed to delete installation' });
  }
}

/**
 * Handle installation_repositories.added event
 * Triggered when repositories are added to the installation
 */
export async function handleInstallationRepositoriesAdded(req: Request, res: Response) {
  const { installation, repositories_added } = req.body;
  
  try {
    const Installation = getInstallationModel();
    
    const inst = await Installation.findOne({ installationId: installation.id });
    
    if (!inst) {
      return res.status(404).json({ error: 'Installation not found' });
    }
    
    // Add new repositories
    for (const repo of repositories_added) {
      inst.repositories.push({
        repoId: repo.id.toString(),
        repoFullName: repo.full_name,
        private: repo.private,
        installedAt: new Date(),
      });
    }
    
    await inst.save();
    
    console.log(`✅ Added ${repositories_added.length} repositories to installation ${installation.id}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding repositories:', error);
    res.status(500).json({ error: 'Failed to add repositories' });
  }
}

/**
 * Handle installation_repositories.removed event
 * Triggered when repositories are removed from the installation
 */
export async function handleInstallationRepositoriesRemoved(req: Request, res: Response) {
  const { installation, repositories_removed } = req.body;
  
  try {
    const Installation = getInstallationModel();
    
    const inst = await Installation.findOne({ installationId: installation.id });
    
    if (!inst) {
      return res.status(404).json({ error: 'Installation not found' });
    }
    
    // Remove repositories
    const removedRepoIds = repositories_removed.map((r: any) => r.id.toString());
    inst.repositories = inst.repositories.filter(
      (repo) => !removedRepoIds.includes(repo.repoId)
    );
    
    await inst.save();
    
    console.log(`✅ Removed ${repositories_removed.length} repositories from installation ${installation.id}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing repositories:', error);
    res.status(500).json({ error: 'Failed to remove repositories' });
  }
}

// ============================================
// PULL REQUEST WEBHOOKS
// ============================================

/**
 * Handle pull_request.opened event
 * Triggered when a new PR is created
 */
export async function handlePROpened(req: Request, res: Response) {
  const { installation, repository, pull_request } = req.body;
  
  try {
    // Get PR files
    const files = await getPRFiles(
      installation.id,
      repository.owner.login,
      repository.name,
      pull_request.number
    );
    
    const PullRequest = getPullRequestModel();
    
    // Save PR (userId is null - no user triggered this)
    const pr = await PullRequest.create({
      installationId: installation.id,
      userId: null,
      repoId: repository.id.toString(),
      repoFullName: repository.full_name,
      number: pull_request.number,
      title: pull_request.title,
      author: pull_request.user.login,
      branchFrom: pull_request.head.ref,
      branchTo: pull_request.base.ref,
      status: 'open',
      filesChanged: files.map((f: any) => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
      })),
      summary: {
        tldr: 'Analysis pending...',
        risks: [],
        labels: [],
        createdAt: new Date(),
      },
    });
    
    console.log(`✅ PR ${pr.repoFullName}#${pr.number} saved`);
    console.log(`   Installation: ${installation.id}`);
    console.log(`   Author: ${pr.author}`);
    
    // TODO: Enqueue for AI analysis (next phase)
    
    res.status(200).json({ success: true, prId: pr._id });
  } catch (error) {
    console.error('Error saving PR:', error);
    res.status(500).json({ error: 'Failed to save PR' });
  }
}

/**
 * Handle pull_request.synchronize event
 * Triggered when a PR is updated with new commits
 */
export async function handlePRSynchronized(req: Request, res: Response) {
  const { installation, repository, pull_request } = req.body;
  
  try {
    // Get updated PR files
    const files = await getPRFiles(
      installation.id,
      repository.owner.login,
      repository.name,
      pull_request.number
    );
    
    const PullRequest = getPullRequestModel();
    
    // Update PR (or create if it doesn't exist)
    const pr = await PullRequest.findOneAndUpdate(
      { repoId: repository.id.toString(), number: pull_request.number },
      {
        $set: {
          title: pull_request.title,
          author: pull_request.user.login,
          branchFrom: pull_request.head.ref,
          branchTo: pull_request.base.ref,
          status: pull_request.state,
          filesChanged: files.map((f: any) => ({
            filename: f.filename,
            additions: f.additions,
            deletions: f.deletions,
          })),
          summary: {
            tldr: 'Analysis pending...',
            risks: [],
            labels: [],
            createdAt: new Date(),
          },
        },
        $setOnInsert: {
          installationId: installation.id,
          userId: null,
          repoId: repository.id.toString(),
          repoFullName: repository.full_name,
          number: pull_request.number,
        },
      },
      { upsert: true, new: true }
    );
    
    console.log(`✅ PR ${pr.repoFullName}#${pr.number} ${pr.wasNew ? 'created' : 'updated'} (synchronized/edited)`);
    
    console.log(`✅ PR ${pr.repoFullName}#${pr.number} updated (synchronized)`);
    
    // TODO: Enqueue for AI analysis (next phase)
    
    res.status(200).json({ success: true, prId: pr._id });
  } catch (error) {
    console.error('Error updating PR:', error);
    res.status(500).json({ error: 'Failed to update PR' });
  }
}

/**
 * Handle pull_request.closed event
 * Triggered when a PR is closed or merged
 */
export async function handlePRClosed(req: Request, res: Response) {
  const { repository, pull_request } = req.body;
  
  try {
    const PullRequest = getPullRequestModel();
    
    // Determine status
    const status = pull_request.merged ? 'merged' : 'closed';
    
    // Update PR
    const pr = await PullRequest.findOneAndUpdate(
      { repoId: repository.id.toString(), number: pull_request.number },
      { status },
      { new: true }
    );
    
    if (!pr) {
      return res.status(404).json({ error: 'PR not found' });
    }
    
    console.log(`✅ PR ${pr.repoFullName}#${pr.number} marked as ${status}`);
    
    res.status(200).json({ success: true, prId: pr._id });
  } catch (error) {
    console.error('Error closing PR:', error);
    res.status(500).json({ error: 'Failed to close PR' });
  }
}

/**
 * Handle pull_request.reopened event
 * Triggered when a closed PR is reopened
 */
export async function handlePRReopened(req: Request, res: Response) {
  const { repository, pull_request } = req.body;
  
  try {
    const PullRequest = getPullRequestModel();
    
    // Update PR
    const pr = await PullRequest.findOneAndUpdate(
      { repoId: repository.id.toString(), number: pull_request.number },
      { status: 'open' },
      { new: true }
    );
    
    if (!pr) {
      return res.status(404).json({ error: 'PR not found' });
    }
    
    console.log(`✅ PR ${pr.repoFullName}#${pr.number} reopened`);
    
    res.status(200).json({ success: true, prId: pr._id });
  } catch (error) {
    console.error('Error reopening PR:', error);
    res.status(500).json({ error: 'Failed to reopen PR' });
  }
}


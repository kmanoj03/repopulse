import { Request, Response } from 'express';
import { getInstallationModel } from '../models/Installation';
import { getUserModel } from '../models/User';
import { getPullRequestModel } from '../models/pullRequest.model';
import { getPRFiles } from '../utils/githubAppAuth';
import { syncOrgMembersToInstallation } from '../utils/orgMembers';
import { prSummaryQueue } from '../queues/prSummaryQueue';

// ============================================
// INSTALLATION WEBHOOKS
// ============================================

/**
 * Handle installation.created event
 * Triggered when someone installs the GitHub App
 * NOTE: This webhook doesn't know which user installed it, so we can't link it to a user here.
 * The callback handler (/api/github/app/setup) should handle user linking via state token.
 */
export async function handleInstallationCreated(req: Request, res: Response) {
  const { installation, repositories } = req.body;
  
  try {
    const Installation = getInstallationModel();
    
    // Check if installation already exists (might have been created by callback handler)
    const existing = await Installation.findOne({ installationId: installation.id });
    
    if (existing) {
      console.log(`ℹ️  Installation ${installation.id} already exists, skipping webhook creation`);
      return res.status(200).json({ success: true, message: 'Installation already exists' });
    }
    
    // Save installation
    await Installation.create({
      installationId: installation.id,
      accountType: installation.account.type,
      accountLogin: installation.account.login,
      accountAvatarUrl: installation.account.avatar_url || '',
      repositories: (repositories || []).map((repo: any) => ({
        repoId: repo.id.toString(),
        repoFullName: repo.full_name,
        private: repo.private,
        installedAt: new Date(),
      })),
    });
    
    console.log(`✅ Installation ${installation.id} created via webhook for ${installation.account.login}`);
    
    // Try to link to user by account login (for User accounts)
    // For Organization accounts, we'll sync all org members
    const accountType = installation.account.type;
    
    if (accountType === 'Organization') {
      // Organization installation - sync all org members
      console.log(`   🔵 Organization installation detected. Syncing org members...`);
      const syncResult = await syncOrgMembersToInstallation(installation.id, installation.account.login);
      console.log(`   Sync result: ${syncResult.updated} users updated, ${syncResult.errors} errors`);
    } else {
      // User account - try to link by username (fallback if callback didn't work)
      // This is a best-effort attempt - the callback with state token is the proper way
      try {
        const User = getUserModel();
        // Try to find user by GitHub username matching the account login
        const user = await User.findOne({ username: installation.account.login });
        if (user) {
          if (!user.installationIds.includes(installation.id)) {
            user.installationIds.push(installation.id);
            await user.save();
            console.log(`   ✅ Linked installation ${installation.id} to user ${user.username} (matched by username)`);
            console.log(`   User now has installationIds: [${user.installationIds.join(', ')}]`);
          } else {
            console.log(`   ℹ️  Installation ${installation.id} already linked to user ${user.username}`);
          }
        } else {
          console.log(`   ⚠️  Could not find user with username "${installation.account.login}" to link installation`);
          console.log(`   Available users:`, await User.find({}).select('username installationIds').lean().then(users => 
            users.map((u: any) => `${u.username} (installs: [${u.installationIds?.join(', ') || 'none'}])`)
          ));
          console.log(`   The callback handler (/api/github/app/setup) should link it when the user completes installation.`);
        }
      } catch (linkError: any) {
        console.warn('   ⚠️  Failed to link installation to user:', linkError.message);
      }
    }
    
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
    const User = getUserModel();
    const installationId = installation.id;
    
    // Mark installation as suspended
    await Installation.findOneAndUpdate(
      { installationId },
      { suspendedAt: new Date() }
    );
    
    console.log(`✅ Installation ${installationId} marked as deleted`);
    
    // Remove this installationId from all users who have it
    const result = await User.updateMany(
      { installationIds: installationId },
      { $pull: { installationIds: installationId } }
    );
    
    console.log(`✅ Removed installation ${installationId} from ${result.modifiedCount} user(s)`);
    
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
  
  console.log(`📥 PR opened webhook: ${repository.full_name}#${pull_request.number}`);
  console.log(`   Installation ID: ${installation.id}`);
  console.log(`   PR Title: ${pull_request.title}`);
  
  try {
    // Check if PR already exists (avoid duplicates)
    const PullRequest = getPullRequestModel();
    const existing = await PullRequest.findOne({
      installationId: installation.id,
      repoId: repository.id.toString(),
      number: pull_request.number,
    });
    
    if (existing) {
      console.log(`ℹ️  PR ${repository.full_name}#${pull_request.number} already exists, skipping`);
      return res.status(200).json({ success: true, message: 'PR already exists', prId: existing._id });
    }
    
    // Get PR files
    let files: any[] = [];
    try {
      files = await getPRFiles(
        installation.id,
        repository.owner.login,
        repository.name,
        pull_request.number
      );
      console.log(`   Fetched ${files.length} files`);
    } catch (fileError: any) {
      console.warn(`   ⚠️  Failed to fetch PR files: ${fileError.message}`);
      // Continue without files - PR can still be saved
    }
    
    // Try to link PR to a user by finding users with this installationId
    let linkedUserId: string | null = null;
    try {
      const User = getUserModel();
      const usersWithInstallation = await User.find({
        installationIds: installation.id,
      }).lean();
      
      if (usersWithInstallation.length === 1) {
        // Only one user has this installation - link it
        linkedUserId = usersWithInstallation[0]._id.toString();
        console.log(`   ✅ Linked PR to user: ${usersWithInstallation[0].username}`);
      } else if (usersWithInstallation.length > 1) {
        // Multiple users have this installation - try to match by PR author's GitHub username
        const prAuthor = pull_request.user.login;
        const matchingUser = usersWithInstallation.find(
          (u: any) => u.username === prAuthor
        );
        if (matchingUser) {
          linkedUserId = matchingUser._id.toString();
          console.log(`   ✅ Linked PR to user by author match: ${matchingUser.username}`);
        } else {
          console.log(`   ℹ️  Multiple users have this installation, but PR author "${prAuthor}" doesn't match any username`);
        }
      } else {
        console.log(`   ℹ️  No users found with installationId ${installation.id} - PR will have userId: null`);
      }
    } catch (userLinkError: any) {
      console.warn(`   ⚠️  Failed to link PR to user: ${userLinkError.message}`);
      // Continue without userId - PR can still be saved
    }
    
    // Save PR
    const pr = await PullRequest.create({
      installationId: installation.id,
      userId: linkedUserId,
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
      summary: null, // Will be populated when summary is generated
      summaryStatus: 'pending', // PR is created, summary not yet generated
      summaryError: null,
      lastSummarizedAt: null,
    });
    
    console.log(`✅ PR ${pr.repoFullName}#${pr.number} saved`);
    console.log(`   PR ID: ${pr._id}`);
    console.log(`   Installation: ${installation.id}`);
    console.log(`   Author: ${pr.author}`);
    console.log(`   Files: ${pr.filesChanged.length}`);
    
    // Enqueue PR summary job
    try {
      await prSummaryQueue.add('generate', {
        pullRequestId: pr._id.toString(),
        installationId: pr.installationId,
        repoFullName: pr.repoFullName,
        number: pr.number,
      });
      console.log(`   📋 PR summary job enqueued`);
    } catch (queueError: any) {
      console.error(`   ⚠️  Failed to enqueue PR summary job:`, queueError.message);
      // Don't fail the webhook - PR is saved, summary can be generated later
    }
    
    res.status(200).json({ success: true, prId: pr._id });
  } catch (error: any) {
    console.error('❌ Error saving PR:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({ error: 'Failed to save PR', message: error.message });
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
    
    // Check if PR exists first
    const existing = await PullRequest.findOne({
      installationId: installation.id,
      repoId: repository.id.toString(),
      number: pull_request.number,
    });
    
    // Try to link PR to a user if it's a new PR
    let linkedUserId: string | null = null;
    if (!existing) {
      try {
        const User = getUserModel();
        const usersWithInstallation = await User.find({
          installationIds: installation.id,
        }).lean();
        
        if (usersWithInstallation.length === 1) {
          linkedUserId = usersWithInstallation[0]._id.toString();
          console.log(`   ✅ Linked PR to user: ${usersWithInstallation[0].username}`);
        } else if (usersWithInstallation.length > 1) {
          const prAuthor = pull_request.user.login;
          const matchingUser = usersWithInstallation.find(
            (u: any) => u.username === prAuthor
          );
          if (matchingUser) {
            linkedUserId = matchingUser._id.toString();
            console.log(`   ✅ Linked PR to user by author match: ${matchingUser.username}`);
          }
        }
      } catch (userLinkError: any) {
        console.warn(`   ⚠️  Failed to link PR to user: ${userLinkError.message}`);
      }
    }
    
    // Update PR (or create if it doesn't exist)
    const updateData: any = {
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
      },
      $setOnInsert: {
        installationId: installation.id,
        userId: linkedUserId,
        repoId: repository.id.toString(),
        repoFullName: repository.full_name,
        number: pull_request.number,
        summary: null,
        summaryStatus: 'pending',
        summaryError: null,
        lastSummarizedAt: null,
      },
    };

    const pr = await PullRequest.findOneAndUpdate(
      { 
        installationId: installation.id,
        repoId: repository.id.toString(), 
        number: pull_request.number 
      },
      updateData,
      { upsert: true, new: true }
    );
    
    // Check if this was a new PR or update
    const wasNew = !existing;
    console.log(`✅ PR ${pr.repoFullName}#${pr.number} ${wasNew ? 'created' : 'updated'} (synchronized/edited)`);
    
    // Enqueue PR summary job (only if it's a new PR or if summary is pending)
    if (wasNew || pr.summaryStatus === 'pending') {
      try {
        await prSummaryQueue.add('generate', {
          pullRequestId: pr._id.toString(),
          installationId: pr.installationId,
          repoFullName: pr.repoFullName,
          number: pr.number,
        });
        console.log(`   📋 PR summary job enqueued`);
      } catch (queueError: any) {
        console.error(`   ⚠️  Failed to enqueue PR summary job:`, queueError.message);
        // Don't fail the webhook - PR is saved, summary can be generated later
      }
    }
    
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
    
    // Update PR and reset summary status to pending
    const pr = await PullRequest.findOneAndUpdate(
      { repoId: repository.id.toString(), number: pull_request.number },
      { 
        status: 'open',
        summaryStatus: 'pending',
        summaryError: null,
      },
      { new: true }
    );
    
    if (!pr) {
      return res.status(404).json({ error: 'PR not found' });
    }
    
    console.log(`✅ PR ${pr.repoFullName}#${pr.number} reopened`);
    
    // Enqueue PR summary job when PR is reopened
    try {
      await prSummaryQueue.add('generate', {
        pullRequestId: pr._id.toString(),
        installationId: pr.installationId,
        repoFullName: pr.repoFullName,
        number: pr.number,
      });
      console.log(`   📋 PR summary job enqueued`);
    } catch (queueError: any) {
      console.error(`   ⚠️  Failed to enqueue PR summary job:`, queueError.message);
      // Don't fail the webhook - PR is reopened, summary can be generated later
    }
    
    res.status(200).json({ success: true, prId: pr._id });
  } catch (error) {
    console.error('Error reopening PR:', error);
    res.status(500).json({ error: 'Failed to reopen PR' });
  }
}


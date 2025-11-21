import { Request, Response } from 'express';
import { signState, verifyState } from '../utils/stateToken';
import { getAppOctokit, getInstallationOctokit } from '../github/appClient';
import { getUserModel } from '../models/User';
import { getInstallationModel } from '../models/Installation';
import { syncOrgMembersToInstallation } from '../utils/orgMembers';

/**
 * POST /api/github/app/install-url
 * Generates a GitHub App installation URL with state token
 * Requires authentication
 */
export async function getInstallUrl(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG || 'repopulse272';

    // Generate state token
    const stateToken = signState({
      userId: user._id.toString(),
      purpose: 'github_app_install',
    });

    // Build install URL (no redirect_url needed - we use polling approach)
    const installUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${encodeURIComponent(stateToken)}`;

    console.log('🔵 Generated install URL:');
    console.log('   Full Install URL:', installUrl);
    console.log('   State token (first 20 chars):', stateToken.substring(0, 20) + '...');
    console.log('   Note: Using polling approach - no redirect URL needed');

    return res.json({ installUrl });
  } catch (error) {
    console.error('Error in getInstallUrl:', error);
    return res.status(500).json({ error: 'Failed to generate install URL' });
  }
}

/**
 * GET /api/github/app/setup
 * Handles the callback from GitHub App installation
 * Verifies state, fetches installation details, and links to user
 */
export async function handleAppSetup(req: Request, res: Response) {
  const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  let APP_BASE_URL = process.env.APP_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3000';
  
  // Remove trailing slash from APP_BASE_URL to avoid double slashes
  APP_BASE_URL = APP_BASE_URL.replace(/\/+$/, '');

  console.log('🔵🔵🔵 GitHub App setup callback received');
  console.log('   Method:', req.method);
  console.log('   URL:', req.url);
  console.log('   Query params:', JSON.stringify(req.query, null, 2));
  console.log('   Full URL would be:', `${APP_BASE_URL}${req.url}`);
  console.log('   Environment check:');
  console.log('     APP_BASE_URL:', APP_BASE_URL);
  console.log('     FRONTEND_BASE_URL:', FRONTEND_BASE_URL);
  console.log('     Is localhost?', APP_BASE_URL.includes('localhost') || APP_BASE_URL.includes('127.0.0.1'));

  try {
    const { installation_id, setup_action, state } = req.query;

    // Validate required parameters
    if (!installation_id || !state) {
      console.error('❌ Missing required parameters:', { installation_id, state });
      return res.redirect(`${FRONTEND_BASE_URL}/error?reason=missing_params`);
    }

    // Verify state token
    let statePayload;
    try {
      statePayload = verifyState(state as string);
      console.log('✅ State token verified, userId:', statePayload.userId);
    } catch (error: any) {
      console.error('❌ Invalid state token:', error.message);
      return res.redirect(`${FRONTEND_BASE_URL}/error?reason=invalid_state`);
    }

    const userId = statePayload.userId;

    // Load user
    const User = getUserModel();
    const user = await User.findById(userId);

    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      return res.redirect(`${FRONTEND_BASE_URL}/error?reason=user_not_found`);
    }

    console.log(`✅ User found: ${user.username} (${user._id})`);

    const installationId = parseInt(installation_id as string, 10);

    if (isNaN(installationId)) {
      console.error('❌ Invalid installation_id:', installation_id);
      return res.redirect(`${FRONTEND_BASE_URL}/error?reason=invalid_installation_id`);
    }

    console.log(`🔵 Fetching installation ${installationId} from GitHub...`);

    // Fetch installation details from GitHub using App Octokit
    const appOctokit = getAppOctokit();
    let installationData;
    try {
      const response = await appOctokit.apps.getInstallation({
        installation_id: installationId,
      });
      installationData = response.data;
      console.log('✅ Installation data fetched from GitHub');
    } catch (error: any) {
      console.error('❌ Failed to fetch installation from GitHub:', error.message);
      if (error.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return res.redirect(`${FRONTEND_BASE_URL}/error?reason=github_api_error`);
    }

    // Extract installation details
    // account can be User or Organization, both have different properties
    const account = installationData.account;
    if (!account) {
      console.error('❌ Installation has no account data');
      return res.redirect(`${FRONTEND_BASE_URL}/error?reason=github_api_error`);
    }
    
    const accountType = 'type' in account && account.type === 'Organization' ? 'Organization' : 'User';
    const accountLogin = 'login' in account ? account.login : ('slug' in account ? account.slug : 'unknown');
    const accountAvatarUrl = account.avatar_url || '';

    console.log(`✅ Account: ${accountLogin} (${accountType})`);

    // Fetch repositories for this installation
    let repositories: Array<{
      repoId: string;
      repoFullName: string;
      private: boolean;
      installedAt: Date;
    }> = [];

    try {
      console.log(`🔵 Fetching repositories for installation ${installationId}...`);
      const installationOctokit = await getInstallationOctokit(installationId);
      const reposResponse = await installationOctokit.apps.listReposAccessibleToInstallation();
      
      // Handle both paginated and non-paginated responses
      const reposList = reposResponse.data?.repositories || reposResponse.data || [];
      
      repositories = reposList.map((repo: any) => ({
        repoId: repo.id.toString(),
        repoFullName: repo.full_name,
        private: repo.private,
        installedAt: new Date(),
      }));
      
      console.log(`✅ Fetched ${repositories.length} repositories`);
      if (repositories.length > 0) {
        console.log(`   Sample repos: ${repositories.slice(0, 3).map((r: any) => r.repoFullName).join(', ')}`);
      } else {
        console.log(`   ⚠️  No repositories found - this is OK, repos can be synced via webhook`);
      }
    } catch (error: any) {
      console.warn('⚠️  Failed to fetch repositories for installation:', error.message);
      if (error.response) {
        console.warn('   Response status:', error.response.status);
        console.warn('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
      if (error.status) {
        console.warn('   Error status:', error.status);
      }
      // Continue without repositories - they can be synced later via webhook
      // This is not a fatal error - installation can still be saved
    }

    // Upsert Installation document
    console.log(`🔵 Upserting Installation document for ${installationId}...`);
    const Installation = getInstallationModel();
    const installationDoc = await Installation.findOneAndUpdate(
      { installationId },
      {
        installationId,
        accountType,
        accountLogin,
        accountAvatarUrl,
        repositories,
        suspendedAt: installationData.suspended_at ? new Date(installationData.suspended_at) : null,
      },
      { upsert: true, new: true }
    );
    console.log(`✅ Installation document saved: ${installationDoc._id}`);

    // Update User: add installationId if not already present
    const hadInstallation = user.installationIds.includes(installationId);
    if (!hadInstallation) {
      console.log(`🔵 Adding installation ${installationId} to user ${user.username}...`);
      user.installationIds.push(installationId);
      await user.save();
      console.log(`✅ User updated. InstallationIds: [${user.installationIds.join(', ')}]`);
    } else {
      console.log(`ℹ️  Installation ${installationId} already linked to user`);
    }

    // If this is an organization installation, sync all org members
    if (accountType === 'Organization') {
      console.log(`🔵 Organization installation detected. Syncing org members...`);
      const syncResult = await syncOrgMembersToInstallation(installationId, accountLogin);
      console.log(`   Sync result: ${syncResult.updated} users updated, ${syncResult.errors} errors`);
    }

    console.log(`✅✅✅ Installation ${installationId} successfully linked to user ${user.username}`);
    console.log(`   Redirecting to: ${FRONTEND_BASE_URL}/dashboard?installed=1`);
    console.log(`   Redirect URL will be: ${FRONTEND_BASE_URL}/dashboard?installed=1`);

    // Redirect to frontend dashboard with success flag
    // Use 302 (temporary redirect) - this is what GitHub expects
    res.status(302);
    res.setHeader('Location', `${FRONTEND_BASE_URL}/dashboard?installed=1`);
    return res.end();
  } catch (error: any) {
    console.error('❌❌❌ Error in handleAppSetup:', error);
    console.error('   Stack:', error.stack);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return res.redirect(`${FRONTEND_BASE_URL}/error?reason=setup_failed`);
  }
}


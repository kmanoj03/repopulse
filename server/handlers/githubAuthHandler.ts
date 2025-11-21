import { Request, Response } from 'express';
import axios from 'axios';
import { getUserModel } from '../models/User';
import { getInstallationModel } from '../models/Installation';
import { generateUserJWT } from '../utils/userAuth';
import { getAppOctokit, getInstallationOctokit } from '../github/appClient';

/**
 * GET /auth/github
 * Redirects user to GitHub App OAuth authorization page
 * Uses GitHub App OAuth (not OAuth App) so we can check /user/installations
 */
export async function handleGitHubLogin(req: Request, res: Response) {
  // Use GitHub App client_id for OAuth (allows checking /user/installations)
  // Fallback to GITHUB_CLIENT_ID for backward compatibility
  const CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  
  if (!CLIENT_ID) {
    console.error('❌ GITHUB_APP_CLIENT_ID or GITHUB_CLIENT_ID is not set in environment variables');
    console.error('   For GitHub App OAuth, use GITHUB_APP_CLIENT_ID from your GitHub App settings');
    return res.status(500).send('Server configuration error: GitHub OAuth not configured');
  }

  // Build redirect URI for OAuth callback
  // This must match the "User authorization callback URL" in your GitHub App settings
  const BACKEND_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
  const redirectUri = `${BACKEND_URL.replace(/\/+$/, '')}/auth/github/callback`;
  
  // GitHub App OAuth - no need for explicit scopes, GitHub App permissions handle it
  // The token will be a GitHub App user token that can call /user/installations
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  console.log('🔵 GitHub App OAuth login - redirect URI:', redirectUri);
  console.log('   ⚠️  Make sure this matches your GitHub App "User authorization callback URL"');
  console.log('   Using GitHub App OAuth (not OAuth App) to enable /user/installations check');
  
  res.redirect(githubAuthUrl);
}

/**
 * GET /auth/github/callback
 * Handles the callback from GitHub OAuth
 */
export async function handleGitHubCallback(req: Request, res: Response) {
  const { code } = req.query;
  // Use GitHub App credentials for OAuth (allows /user/installations)
  // Fallback to OAuth App credentials for backward compatibility
  const CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  const CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;
  const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ GitHub OAuth credentials not configured');
    console.error('   For GitHub App OAuth, set GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET');
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_not_configured`);
  }
  
  try {
    // 1. Exchange code for GitHub App user access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    
    if (!accessToken) {
      return res.redirect(`${FRONTEND_URL}/login?error=no_access_token`);
    }
    
    // 2. Get user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    
    const githubUser = userResponse.data;
    
    // 3. Fetch installations the user has access to
    // This ONLY works with GitHub App OAuth tokens (not OAuth App tokens)
    let installationIds: number[] = [];
    let installationDetails: any[] = []; // Store full installation details for upserting
    
    try {
      console.log(`🔵 Fetching installations for user ${githubUser.login}...`);
      console.log(`   Using token type: ${process.env.GITHUB_APP_CLIENT_ID ? 'GitHub App OAuth' : 'OAuth App (fallback)'}`);
      
      const installationsResponse = await axios.get('https://api.github.com/user/installations', {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
      
      console.log(`   Raw API response status: ${installationsResponse.status}`);
      console.log(`   Raw API response data keys:`, Object.keys(installationsResponse.data || {}));
      
      if (installationsResponse.data && installationsResponse.data.installations) {
        let allInstallations = installationsResponse.data.installations;
        console.log(`   Total installations returned: ${allInstallations.length}`);
        
        // Log first installation structure for debugging
        if (allInstallations.length > 0) {
          const sample = allInstallations[0];
          console.log(`   Sample installation structure:`, JSON.stringify({
            id: sample.id,
            app_id: sample.app_id,
            app_slug: sample.app_slug,
            app: sample.app ? { id: sample.app.id, name: sample.app.name } : 'no app object',
            account: sample.account ? { login: sample.account.login, type: sample.account.type } : 'no account',
          }, null, 2));
        }
        
        // Filter to only installations of OUR GitHub App (if GITHUB_APP_ID is set)
        if (GITHUB_APP_ID) {
          const ourAppId = parseInt(GITHUB_APP_ID, 10);
          console.log(`   Filtering for our GitHub App ID: ${ourAppId}`);
          
          allInstallations = allInstallations.filter((inst: any) => {
            // The /user/installations endpoint returns app_id directly, not an app object
            // Check app_id (direct field) first, then fallback to app.id if app object exists
            const appId = inst.app_id || (inst.app && inst.app.id);
            const matches = appId === ourAppId;
            
            if (!matches) {
              console.log(`   ⚠️  Installation ${inst.id} belongs to app ${appId || 'unknown'}, not our app ${ourAppId}`);
            } else {
              console.log(`   ✅ Installation ${inst.id} matches our app ${ourAppId}`);
            }
            return matches;
          });
          console.log(`   ✅ Filtered to ${allInstallations.length} installation(s) of our GitHub App (ID: ${ourAppId})`);
        } else {
          console.log(`   ⚠️  GITHUB_APP_ID not set - including ALL installations (this might include other apps)`);
        }
        
        installationDetails = allInstallations;
        installationIds = allInstallations.map((inst: any) => inst.id);
        console.log(`✅ Found ${installationIds.length} installation(s) for user ${githubUser.login}: [${installationIds.join(', ')}]`);
      } else {
        console.log(`ℹ️  No installations found in response for user ${githubUser.login}`);
        console.log(`   Response data:`, JSON.stringify(installationsResponse.data, null, 2));
      }
    } catch (installError: any) {
      console.error(`❌ Failed to fetch installations for user ${githubUser.login}:`, installError.message);
      
      // Check if this is the "must authenticate with GitHub App" error
      if (installError.response?.status === 403 || installError.response?.status === 401) {
        const errorMessage = installError.response?.data?.message || '';
        console.error(`   Error status: ${installError.response.status}`);
        console.error(`   Error message: ${errorMessage}`);
        if (errorMessage.includes('GitHub App') || errorMessage.includes('installation')) {
          console.error('   ❌ This error means you are using OAuth App token, not GitHub App OAuth token!');
          console.error('   ❌ Switch to GitHub App OAuth by using GITHUB_APP_CLIENT_ID instead of GITHUB_CLIENT_ID');
        }
      }
      
      // Continue with empty installationIds - user can install app manually
      if (installError.response) {
        console.error(`   Response status: ${installError.response.status}`);
        console.error(`   Response data:`, JSON.stringify(installError.response.data, null, 2));
      }
    }
    
    // 3b. Upsert Installation documents for each found installation
    if (installationDetails.length > 0) {
      console.log(`🔵 Upserting ${installationDetails.length} Installation document(s)...`);
      const Installation = getInstallationModel();
      const appOctokit = getAppOctokit();
      
      for (const inst of installationDetails) {
        try {
          // Fetch full installation details from GitHub
          const fullInstallationResponse = await appOctokit.apps.getInstallation({
            installation_id: inst.id,
          });
          const fullInstallation = fullInstallationResponse.data;
          
          const account = fullInstallation.account;
          if (!account) {
            console.warn(`   ⚠️  Installation ${inst.id} has no account data, skipping`);
            continue;
          }
          
          const accountType = 'type' in account && account.type === 'Organization' ? 'Organization' : 'User';
          const accountLogin = 'login' in account ? account.login : ('slug' in account ? account.slug : 'unknown');
          const accountAvatarUrl = account.avatar_url || '';
          
          // Fetch repositories for this installation
          let repositories: Array<{
            repoId: string;
            repoFullName: string;
            private: boolean;
            installedAt: Date;
          }> = [];
          
          try {
            const installationOctokit = await getInstallationOctokit(inst.id);
            const reposResponse = await installationOctokit.apps.listReposAccessibleToInstallation();
            const reposList = reposResponse.data?.repositories || reposResponse.data || [];
            repositories = reposList.map((repo: any) => ({
              repoId: repo.id.toString(),
              repoFullName: repo.full_name,
              private: repo.private,
              installedAt: new Date(),
            }));
            console.log(`   ✅ Fetched ${repositories.length} repositories for installation ${inst.id}`);
          } catch (repoError: any) {
            console.warn(`   ⚠️  Failed to fetch repositories for installation ${inst.id}:`, repoError.message);
            // Continue without repositories - they can be synced later via webhook
          }
          
          // Upsert Installation document
          await Installation.findOneAndUpdate(
            { installationId: inst.id },
            {
              installationId: inst.id,
              accountType,
              accountLogin,
              accountAvatarUrl,
              repositories,
              suspendedAt: fullInstallation.suspended_at ? new Date(fullInstallation.suspended_at) : null,
            },
            { upsert: true, new: true }
          );
          
          console.log(`   ✅ Upserted Installation document for ${inst.id} (${accountLogin})`);
        } catch (upsertError: any) {
          console.error(`   ❌ Failed to upsert Installation ${inst.id}:`, upsertError.message);
          // Continue with other installations
        }
      }
    }
    
    // 4. Create/update user with synced installationIds
    const User = getUserModel();
    const existingUser = await User.findOne({ githubId: githubUser.id });
    
    let user;
    if (existingUser) {
      // Update existing user
      existingUser.username = githubUser.login;
      existingUser.email = githubUser.email || `${githubUser.login}@github.local`;
      existingUser.avatarUrl = githubUser.avatar_url || '';
      existingUser.lastLoginAt = new Date();
      
      // Sync installationIds from GitHub
      // Merge with existing ones to avoid losing any (in case of edge cases)
      const existingIds = existingUser.installationIds || [];
      const mergedIds = [...new Set([...existingIds, ...installationIds])];
      existingUser.installationIds = mergedIds;
      
      await existingUser.save();
      user = existingUser;
      
      if (mergedIds.length > existingIds.length) {
        console.log(`   ✅ Updated installationIds: [${existingIds.join(', ')}] → [${mergedIds.join(', ')}]`);
      }
    } else {
      // Create new user with synced installationIds
      user = await User.create({
        githubId: githubUser.id,
        username: githubUser.login,
        email: githubUser.email || `${githubUser.login}@github.local`,
        avatarUrl: githubUser.avatar_url || '',
        installationIds: installationIds,
        lastLoginAt: new Date(),
      });
    }
    
    console.log(`✅ User ${user.username} logged in`);
    console.log(`   Installations: ${user.installationIds.length > 0 ? user.installationIds.join(', ') : 'none (onboarding required)'}`);
    
    // 4. Generate JWT
    // Use first installation if available, otherwise 0 (dashboard will handle onboarding)
    const token = generateUserJWT({
      userId: user._id.toString(),
      githubId: user.githubId,
      username: user.username,
      installationId: user.installationIds.length > 0 ? user.installationIds[0] : 0,
    });
    
    // 6. Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (error: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.error('❌ OAuth error:', error.message);
    
    // Log detailed error for debugging
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
    
    // Provide specific error messages
    if (error.response?.status === 401) {
      console.error('   Check your GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET');
      return res.redirect(`${frontendUrl}/login?error=invalid_credentials`);
    }
    
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
}

/**
 * POST /auth/switch-installation
 * Allows user to switch between installations
 */
export async function handleSwitchInstallation(req: Request, res: Response) {
  try {
    const { userId, installationId } = req.body;
    
    if (!userId || !installationId) {
      return res.status(400).json({ error: 'userId and installationId required' });
    }
    
    const User = getUserModel();
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify user has access to this installation
    if (!user.installationIds.includes(installationId)) {
      return res.status(403).json({ error: 'Access denied to this installation' });
    }
    
    // Generate new JWT with selected installation
    const token = generateUserJWT({
      userId: user._id.toString(),
      githubId: user.githubId,
      username: user.username,
      installationId,
    });
    
    res.json({ token });
  } catch (error) {
    console.error('Switch installation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


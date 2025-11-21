import { Request, Response } from 'express';
import axios from 'axios';
import { getUserModel } from '../models/User';
import { generateUserJWT } from '../utils/userAuth';

/**
 * GET /auth/github
 * Redirects user to GitHub OAuth authorization page
 */
export async function handleGitHubLogin(req: Request, res: Response) {
  const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  
  if (!CLIENT_ID) {
    console.error('❌ GITHUB_CLIENT_ID is not set in environment variables');
    return res.status(500).send('Server configuration error: GitHub OAuth not configured');
  }

  // Build redirect URI for OAuth callback
  // This must match the "Authorization callback URL" in your GitHub OAuth App settings
  // NOTE: This is different from GitHub App installation - OAuth login still needs redirect_uri
  const BACKEND_URL = process.env.BACKEND_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
  const redirectUri = `${BACKEND_URL.replace(/\/+$/, '')}/auth/github/callback`;
  
  // Request scope to read user installations
  // read:user, user:email - basic user info
  // read:org - to see org installations (if user is member)
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email,read:org`;
  
  console.log('🔵 OAuth login - redirect URI:', redirectUri);
  console.log('   ⚠️  Make sure this matches your GitHub OAuth App "Authorization callback URL"');
  
  res.redirect(githubAuthUrl);
}

/**
 * GET /auth/github/callback
 * Handles the callback from GitHub OAuth
 */
export async function handleGitHubCallback(req: Request, res: Response) {
  const { code } = req.query;
  const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ GitHub OAuth credentials not configured');
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_not_configured`);
  }
  
  try {
    // 1. Exchange code for access token
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
      headers: { Authorization: `token ${accessToken}` },
    });
    
    const githubUser = userResponse.data;
    
    // 3. Fetch installations the user has access to
    let installationIds: number[] = [];
    try {
      console.log(`🔵 Fetching installations for user ${githubUser.login}...`);
      const installationsResponse = await axios.get('https://api.github.com/user/installations', {
        headers: { Authorization: `token ${accessToken}` },
      });
      
      if (installationsResponse.data && installationsResponse.data.installations) {
        installationIds = installationsResponse.data.installations.map((inst: any) => inst.id);
        console.log(`✅ Found ${installationIds.length} installation(s) for user ${githubUser.login}: [${installationIds.join(', ')}]`);
      } else {
        console.log(`ℹ️  No installations found for user ${githubUser.login}`);
      }
    } catch (installError: any) {
      console.warn(`⚠️  Failed to fetch installations for user ${githubUser.login}:`, installError.message);
      // Continue with empty installationIds - user can install app manually
      if (installError.response) {
        console.warn(`   Response status: ${installError.response.status}`);
        console.warn(`   Response data:`, installError.response.data);
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


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

  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3000'}/auth/github/callback`;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&scope=read:user,user:email`;
  console.log('githubAuthUrl', githubAuthUrl);
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
    console.log('accessToken', accessToken);
    // console.log('tokenResponse', tokenResponse);

    if (!accessToken) {
      return res.redirect(`${FRONTEND_URL}/login?error=no_access_token`);
    }
    
    // 2. Get user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}` },
    });
    
    const githubUser = userResponse.data;
    console.log('githubUser', githubUser);
    
    // 3. Get installations from OUR database (not GitHub API)
    // Installations are stored when webhooks are received
    const { getInstallationModel } = await import('../models/Installation');
    const Installation = getInstallationModel();
    
    const installations = await Installation.find({}).lean();
    
    if (installations.length === 0) {
      console.warn(`⚠️  No installations found in database. Please install the GitHub App on at least one repository.`);
      return res.redirect(`${FRONTEND_URL}/login?error=no_installations`);
    }
    
    // For now, give user access to all installations
    // TODO: Later, implement proper user-installation association
    const installationIds = installations.map((inst: any) => inst.installationId);
    console.log('installationIds', installationIds);
    
    // 4. Create/update user
    const User = getUserModel();
    const user = await User.findOneAndUpdate(
      { githubId: githubUser.id },
      {
        githubId: githubUser.id,
        username: githubUser.login,
        email: githubUser.email || `${githubUser.login}@github.local`,
        avatarUrl: githubUser.avatar_url || '',
        installationIds,
        lastLoginAt: new Date(),
      },
      { upsert: true, new: true }
    );
    
    console.log(`✅ User ${user.username} logged in`);
    console.log(`   Installations: ${installationIds.join(', ')}`);
    
    // 5. Generate JWT with first installation as default
    const token = generateUserJWT({
      userId: user._id.toString(),
      githubId: user.githubId,
      username: user.username,
      installationId: installationIds[0],
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


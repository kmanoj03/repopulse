import { Request, Response } from 'express';
import axios from 'axios';
import { getUserModel } from './models/User';

/**
 * Test file with issues similar to githubAuthHandler.ts
 * Issues: Missing error handling, type assertions, missing validation
 */
export async function testHandleGitHubLogin(req: Request, res: Response) {
  // Issue: No validation that environment variable exists
  const CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID;
  
  // Issue: Building URL without checking if CLIENT_ID is defined
  const redirectUri = `${process.env.APP_BASE_URL}/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  res.redirect(githubAuthUrl);
}

/**
 * Test function with missing error handling and type assertions
 */
export async function testHandleGitHubCallback(req: Request, res: Response) {
  const { code } = req.query;
  
  // Issue: No validation that code exists
  const CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID;
  const CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET;
  
  // Issue: Type assertion without validation
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
  
  // Issue: No check if access_token exists in response
  const accessToken = tokenResponse.data.access_token;
  
  // Issue: Using accessToken without validation
  const userResponse = await axios.get('https://api.github.com/user', {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  const githubUser = userResponse.data;
  
  // Issue: Accessing properties without null checks
  const userId = githubUser.id;
  const username = githubUser.login;
  const email = githubUser.email; // Issue: email might be null
  
  // Issue: No error handling for installations API call
  const installationsResponse = await axios.get('https://api.github.com/user/installations', {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  // Issue: No check if installations array exists
  const installations = installationsResponse.data.installations;
  const installationIds = installations.map((inst: any) => inst.id);
  
  const User = getUserModel();
  
  // Issue: Creating user without validation
  const user = await User.create({
    githubId: userId,
    username: username,
    email: email, // Issue: email could be null
    installationIds: installationIds,
  });
  
  // Issue: Generating token without checking if user was created successfully
  const token = generateUserJWT({
    userId: user._id.toString(),
    githubId: user.githubId,
    username: user.username,
    installationId: installationIds[0], // Issue: Could be undefined if array is empty
  });
  
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
}

/**
 * Test function with missing input validation
 */
export async function testSwitchInstallation(req: Request, res: Response) {
  const { userId, installationId } = req.body;
  
  // Issue: No validation of request body structure
  const User = getUserModel();
  const user = await User.findById(userId);
  
  // Issue: No null check before accessing user properties
  const hasAccess = user.installationIds.includes(installationId);
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Issue: Type assertion without validation
  const token = generateUserJWT({
    userId: user._id.toString(),
    githubId: user.githubId,
    username: user.username,
    installationId: installationId,
  });
  
  res.json({ token });
}

// Issue: Function used but not imported/defined
function generateUserJWT(payload: any): string {
  return 'mock-token';
}


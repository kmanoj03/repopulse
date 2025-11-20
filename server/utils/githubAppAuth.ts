import fs from 'fs';
import jwt from 'jsonwebtoken';
import axios from 'axios';

interface GitHubAppJWTPayload {
  iat: number;
  exp: number;
  iss: string;
}

/**
 * Generate GitHub App JWT (valid for 10 minutes)
 * Used to authenticate as the GitHub App itself
 */
export function generateGitHubAppJWT(): string {
  // Read env variables inside the function to ensure they're loaded
  const APP_ID = process.env.GITHUB_APP_ID || '2317963';
  const PRIVATE_KEY_PATH = process.env.GITHUB_PRIVATE_KEY_PATH || './private-key.pem';
  
  try {
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    
    const payload: GitHubAppJWTPayload = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (10 * 60), // 10 minutes
      iss: APP_ID,
    };
    
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  } catch (error: any) {
    console.error(`❌ Failed to read GitHub App private key from: ${PRIVATE_KEY_PATH}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Make sure GITHUB_PRIVATE_KEY_PATH in .env points to a valid .pem file`);
    throw new Error('GitHub App private key not found or invalid');
  }
}

/**
 * Get installation access token
 * This token is used to make API calls on behalf of an installation
 * 
 * @param installationId - The GitHub installation ID
 * @returns Access token (valid for 1 hour)
 */
export async function getInstallationAccessToken(
  installationId: number
): Promise<string> {
  const appJWT = generateGitHubAppJWT();
  
  const response = await axios.post(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {},
    {
      headers: {
        Authorization: `Bearer ${appJWT}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  
  return response.data.token;
}

/**
 * Get all repositories for an installation
 * Returns repos that the installation has access to
 */
export async function getInstallationRepositories(installationId: number) {
  const accessToken = await getInstallationAccessToken(installationId);
  
  const response = await axios.get(
    'https://api.github.com/installation/repositories',
    {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  
  return response.data.repositories.map((repo: any) => ({
    repoId: repo.id.toString(),
    repoFullName: repo.full_name,
    private: repo.private,
  }));
}

/**
 * Get PR details from GitHub
 */
export async function getPRFromGitHub(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
) {
  const accessToken = await getInstallationAccessToken(installationId);
  
  const response = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  
  return response.data;
}

/**
 * Get PR files from GitHub
 */
export async function getPRFiles(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
) {
  const accessToken = await getInstallationAccessToken(installationId);
  
  const response = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  
  return response.data.map((file: any) => ({
    filename: file.filename,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch,
  }));
}


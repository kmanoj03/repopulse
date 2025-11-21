import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import fs from 'fs';

/**
 * Get the GitHub App private key from environment
 * Supports:
 * - File path (GITHUB_PRIVATE_KEY_PATH)
 * - Direct key as env var (GITHUB_APP_PRIVATE_KEY) - supports multiline or base64
 */
function getPrivateKey(): string {
  // Try direct env var first (supports multiline or base64)
  const directKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (directKey) {
    // If it looks like base64, decode it
    if (!directKey.includes('-----BEGIN')) {
      try {
        return Buffer.from(directKey, 'base64').toString('utf8');
      } catch {
        // If base64 decode fails, assume it's already the key
        return directKey;
      }
    }
    return directKey;
  }

  // Fall back to file path
  const keyPath = process.env.GITHUB_PRIVATE_KEY_PATH || './private-key.pem';
  try {
    return fs.readFileSync(keyPath, 'utf8');
  } catch (error: any) {
    console.error(`❌ Failed to read GitHub App private key from: ${keyPath}`);
    console.error(`   Error: ${error.message}`);
    throw new Error('GitHub App private key not found or invalid');
  }
}

let appOctokitInstance: Octokit | null = null;

/**
 * Get an Octokit instance authenticated as the GitHub App
 * Use this for app-level API calls (e.g., listing installations)
 */
export function getAppOctokit(): Octokit {
  if (appOctokitInstance) {
    return appOctokitInstance;
  }

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = getPrivateKey();

  if (!appId) {
    throw new Error('GITHUB_APP_ID is not set in environment variables');
  }

  appOctokitInstance = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
    },
  });

  return appOctokitInstance;
}

/**
 * Get an Octokit instance authenticated as a specific installation
 * Use this for installation-level API calls (e.g., listing repos, PRs)
 */
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = getPrivateKey();

  if (!appId) {
    throw new Error('GITHUB_APP_ID is not set in environment variables');
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  });
}


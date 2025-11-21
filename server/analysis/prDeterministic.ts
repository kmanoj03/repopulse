import { DiffStats } from '../models/pullRequest.model';

export type FileChange = {
  filename: string;
  additions: number;
  deletions: number;
  status?: string; // "added" | "modified" | "removed" | etc.
  patch?: string | null; // unified diff from GitHub, if available
};

export type DeterministicAnalysis = {
  systemLabels: string[];
  riskFlags: string[];
  riskScore: number;
  diffStats: DiffStats;
};

export type DeterministicAnalysisInput = {
  filesChanged: FileChange[];
};

// Secret patterns to detect in diffs
const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/, // AWS Access Key ID
  /ghp_[0-9A-Za-z]{36}/, // GitHub Personal Access Token
  /xox[baprs]-[0-9A-Za-z-]{20,}/, // Slack tokens
  /secret_key\s*=/i,
  /api_key\s*=/i,
  /password\s*=/i,
  /-----BEGIN PRIVATE KEY-----/,
];

/**
 * Check if a diff chunk contains potential secrets
 */
function containsSecrets(diffChunk: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(diffChunk));
}

/**
 * Derive system labels based on file paths and names
 */
function deriveSystemLabels(files: FileChange[]): string[] {
  const labels = new Set<string>();

  for (const file of files) {
    const f = file.filename.toLowerCase();

    if (f.startsWith('server/') || f.startsWith('src/routes/') || f.includes('api/')) {
      labels.add('backend');
    }

    if (f.startsWith('client/') || f.startsWith('src/components/') || f.includes('frontend')) {
      labels.add('frontend');
    }

    if (f.includes('routes')) {
      labels.add('routes');
    }

    if (f.includes('config') || f.includes('.env') || f.includes('settings')) {
      labels.add('config');
    }

    if (
      f.includes('.github/workflows') ||
      f.includes('deploy') ||
      f.includes('pipeline') ||
      f.includes('infra')
    ) {
      labels.add('devops');
    }

    if (f.includes('auth') || f.includes('login') || f.includes('jwt')) {
      labels.add('security');
    }
  }

  return [...labels];
}

/**
 * Analyze a pull request deterministically based on file changes
 * 
 * This function performs rule-based analysis without requiring LLM calls.
 * It examines file paths, diff sizes, and patch content to derive:
 * - System labels (backend, frontend, security, etc.)
 * - Risk flags (large-diff, secrets-suspected, auth-change, etc.)
 * - Risk score (0-100)
 * - Diff statistics
 */
export function analyzePullRequestDeterministic(
  input: DeterministicAnalysisInput
): DeterministicAnalysis {
  const { filesChanged } = input;

  // Compute diff statistics
  const totalAdditions = filesChanged.reduce((s, f) => s + (f.additions || 0), 0);
  const totalDeletions = filesChanged.reduce((s, f) => s + (f.deletions || 0), 0);
  const changedFilesCount = filesChanged.length;

  const diffStats: DiffStats = {
    totalAdditions,
    totalDeletions,
    changedFilesCount,
  };

  const riskFlags = new Set<string>();
  const systemLabels = new Set<string>(deriveSystemLabels(filesChanged));

  // a) Large diff flags
  const totalChanges = totalAdditions + totalDeletions;

  if (totalChanges > 500) {
    riskFlags.add('large-diff');
  }
  if (totalChanges > 1500) {
    riskFlags.add('very-large-diff');
  }

  // b) Secret detection via patch/diff
  for (const file of filesChanged) {
    if (!file.patch) continue;
    if (containsSecrets(file.patch)) {
      riskFlags.add('secrets-suspected');
      systemLabels.add('security');
      break; // one is enough to flag
    }
  }

  // c) Risky area flags (auth/config/CI etc.)
  for (const file of filesChanged) {
    const f = file.filename.toLowerCase();

    if (f.includes('auth') || f.includes('login') || f.includes('jwt')) {
      riskFlags.add('auth-change');
    }

    if (f.includes('config') || f.includes('.env') || f.includes('settings')) {
      riskFlags.add('config-change');
    }

    if (
      f.includes('.github/workflows') ||
      f.includes('deploy') ||
      f.includes('infra') ||
      f.includes('pipeline')
    ) {
      riskFlags.add('ci-cd-change');
    }
  }

  // d) Risk score calculation (additive weights)
  let riskScore = 0;
  if (riskFlags.has('large-diff')) riskScore += 20;
  if (riskFlags.has('very-large-diff')) riskScore += 20;
  if (riskFlags.has('secrets-suspected')) riskScore += 40;
  if (riskFlags.has('auth-change')) riskScore += 20;
  if (riskFlags.has('config-change')) riskScore += 15;
  if (riskFlags.has('ci-cd-change')) riskScore += 15;
  if (riskScore > 100) riskScore = 100;

  return {
    systemLabels: [...systemLabels],
    riskFlags: [...riskFlags],
    riskScore,
    diffStats,
  };
}


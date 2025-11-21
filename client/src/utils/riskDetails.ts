import { PRDoc } from "../types/contracts";

interface RiskDetails {
  files: Array<{ filename: string; additions: number; deletions: number }>;
  reason: string;
}

/**
 * Get the files and reason text for a given risk flag
 * Maps risk flags to relevant files using the same deterministic logic as the backend
 */
export function getDetailsForRisk(flag: string, pr: PRDoc): RiskDetails {
  const allFiles = pr.filesChanged;
  let matchedFiles: typeof allFiles = [];
  let reason = "";

  switch (flag) {
    case "secrets-suspected":
      // In the backend, this checks patch content for secret patterns
      // Since we don't have patches in the frontend model, we return all files
      // In a real implementation, you'd want to fetch patches or store which files had secrets
      matchedFiles = allFiles;
      reason = "Potential secrets or sensitive credentials detected in code changes. This could include API keys, passwords, tokens, or private keys. Review these files carefully to ensure no sensitive data is committed.";
      break;

    case "auth-change":
      // Files with auth/login/jwt in the name
      matchedFiles = allFiles.filter((f) => {
        const filename = f.filename.toLowerCase();
        return (
          filename.includes("auth") ||
          filename.includes("login") ||
          filename.includes("jwt")
        );
      });
      reason = "Changes detected in authentication or authorization code. These modifications could affect user login, session management, or access control. Ensure security best practices are followed.";
      break;

    case "config-change":
      // Files with config/.env/settings in the name
      matchedFiles = allFiles.filter((f) => {
        const filename = f.filename.toLowerCase();
        return (
          filename.includes("config") ||
          filename.includes(".env") ||
          filename.includes("settings")
        );
      });
      reason = "Configuration files have been modified. Changes to config files can affect application behavior, environment variables, or deployment settings. Verify all changes are intentional and documented.";
      break;

    case "ci-cd-change":
      // Files in .github/workflows or with deploy/infra/pipeline in the name
      matchedFiles = allFiles.filter((f) => {
        const filename = f.filename.toLowerCase();
        return (
          filename.includes(".github/workflows") ||
          filename.includes("deploy") ||
          filename.includes("infra") ||
          filename.includes("pipeline")
        );
      });
      reason = "CI/CD pipeline or infrastructure files have been changed. These modifications can affect automated builds, deployments, or infrastructure provisioning. Test thoroughly in a staging environment first.";
      break;

    case "large-diff":
      // All files (large diff means the entire PR is large)
      matchedFiles = allFiles;
      reason = `This PR contains a significant number of changes (${pr.diffStats?.totalAdditions || 0} additions, ${pr.diffStats?.totalDeletions || 0} deletions). Large PRs are harder to review thoroughly and may hide bugs or security issues. Consider breaking into smaller PRs when possible.`;
      break;

    case "very-large-diff":
      // All files (very large diff means the entire PR is very large)
      matchedFiles = allFiles;
      reason = `This PR contains an exceptionally large number of changes (${pr.diffStats?.totalAdditions || 0} additions, ${pr.diffStats?.totalDeletions || 0} deletions). Very large PRs significantly increase review complexity and error risk. Strongly consider splitting this into multiple smaller, focused PRs.`;
      break;

    default:
      // Unknown flag - return all files
      matchedFiles = allFiles;
      reason = "This area was flagged as potentially risky based on automated code pattern analysis. Please review the changes carefully.";
      break;
  }

  // Try to match with LLM-generated risk text if available
  if (pr.summary?.risks && pr.summary.risks.length > 0) {
    const flagKeywords = flag.replace(/-/g, " ");
    const matchingRisk = pr.summary.risks.find((risk) =>
      risk.toLowerCase().includes(flagKeywords)
    );
    
    if (matchingRisk) {
      // Use the LLM's risk description if we found a match
      reason = matchingRisk;
    } else if (pr.summary.risks.length > 0 && flag !== "large-diff" && flag !== "very-large-diff") {
      // If no match but we have risks, append the first risk as additional context
      reason = `${reason}\n\nAdditional concern: ${pr.summary.risks[0]}`;
    }
  }

  return {
    files: matchedFiles,
    reason,
  };
}


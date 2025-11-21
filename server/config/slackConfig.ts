/**
 * Slack configuration module for RepoPulse
 * 
 * Handles configuration for Slack notifications via Incoming Webhooks.
 * Validates configuration at startup to fail fast on misconfiguration.
 */

export interface SlackConfig {
  enabled: boolean;
  webhookUrl: string | null;
  riskThreshold: number;
}

/**
 * Parse boolean from environment variable
 * "true" (case-insensitive) → true, everything else → false
 */
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase().trim() === 'true';
}

/**
 * Parse number from environment variable with fallback
 */
function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Slack configuration loaded from environment variables
 */
export const slackConfig: SlackConfig = {
  enabled: parseBoolean(process.env.SLACK_ENABLED),
  webhookUrl: process.env.SLACK_WEBHOOK_URL || null,
  riskThreshold: parseNumber(process.env.SLACK_RISK_THRESHOLD, 60),
};

/**
 * Assert that Slack configuration is valid
 * 
 * Throws an error if Slack is enabled but webhook URL is missing.
 * Call this during server startup to fail fast on misconfiguration.
 * 
 * @throws {Error} If Slack is enabled but webhook URL is missing
 */
export function assertSlackConfig(): void {
  if (slackConfig.enabled && !slackConfig.webhookUrl) {
    throw new Error(
      'Slack is enabled (SLACK_ENABLED=true) but SLACK_WEBHOOK_URL is not set. ' +
      'Please provide a valid Slack Incoming Webhook URL or set SLACK_ENABLED=false.'
    );
  }
}


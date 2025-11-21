import { Queue } from "bullmq";
import { redisConnection } from "./redisConnection";

/**
 * Job data structure for Slack PR notifications
 */
export type SlackPrNotificationJobData = {
  pullRequestId: string;
  repoFullName: string;
  number: number;
  title: string;
  author: string;
  tldr: string;
  riskScore: number;
  mainRiskFlags: string[];
  systemLabels: string[];
  htmlUrl: string;
  dashboardUrl?: string;
};

/**
 * Alias for backward compatibility
 */
export type SlackNotifyJobData = SlackPrNotificationJobData;

/**
 * Slack Notification Queue
 * 
 * This queue handles Slack notification jobs.
 * Jobs are enqueued when PRs need to be notified to Slack channels.
 * 
 * Usage:
 * ```typescript
 * import { slackNotifyQueue } from './queues/slackNotifyQueue';
 * 
 * await slackNotifyQueue.add('notify', {
 *   payload: {
 *     text: "New PR opened",
 *     blocks: [...]
 *   }
 * });
 * ```
 */
export const slackNotifyQueue = new Queue<SlackNotifyJobData>("pr-notify-slack", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times on failure
    backoff: {
      type: "exponential",
      delay: 2000, // Start with 2 second delay, exponential backoff
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});


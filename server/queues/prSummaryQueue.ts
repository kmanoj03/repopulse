import { Queue } from "bullmq";
import { redisConnection } from "./redisConnection";

/**
 * Job data structure for PR summary generation
 */
export type PrSummaryJobData = {
  pullRequestId: string;   // Mongo _id as string
  installationId: number;
  repoFullName: string;    // "owner/repo"
  number: number;          // PR number
};

/**
 * PR Summary Queue
 * 
 * This queue handles PR summary generation jobs.
 * Jobs are enqueued when:
 * - A new PR is created (via webhook)
 * - A PR is updated/synchronized (via webhook)
 * - User manually triggers regeneration (via API)
 * 
 * Usage:
 * ```typescript
 * import { prSummaryQueue } from './queues/prSummaryQueue';
 * 
 * await prSummaryQueue.add('generate', {
 *   pullRequestId: pr._id.toString(),
 *   installationId: pr.installationId,
 *   repoFullName: pr.repoFullName,
 *   number: pr.number,
 * });
 * ```
 */
export const prSummaryQueue = new Queue<PrSummaryJobData>("pr-summary", {
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


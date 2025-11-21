import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redisConnection } from "../queues/redisConnection";
import mongoose from "mongoose";
import { getPullRequestModel } from "../models/pullRequest.model";
import { PrSummaryJobData } from "../queues/prSummaryQueue";
import { getInstallationOctokit } from "../github/appClient";
import { PullRequestSummary } from "../models/pullRequest.model";
import { analyzePullRequestDeterministic, FileChange } from "../analysis/prDeterministic";

/**
 * Initialize MongoDB connection
 */
async function initMongo() {
  if (mongoose.connection.readyState === 1) {
    console.log("[pr-summary-worker] MongoDB already connected");
    return;
  }

  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/repopulse";
  await mongoose.connect(MONGODB_URI);
  console.log("[pr-summary-worker] Connected to MongoDB");
}

/**
 * Fetch PR data and files from GitHub
 * 
 * @param jobData - Job data containing PR information
 * @returns Object containing filesChanged array and PR data
 */
async function fetchPRData(jobData: PrSummaryJobData): Promise<{
  filesChanged: FileChange[];
  prData: any;
}> {
  const { installationId, repoFullName, number } = jobData;

  console.log(`[pr-summary-worker] Fetching PR data for ${repoFullName}#${number}`);

  // 1) GitHub client for that installation
  const octokit = await getInstallationOctokit(installationId);

  // 2) Parse owner and repo from repoFullName
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repoFullName format: ${repoFullName}`);
  }

  // 3) Pull PR data and files in parallel
  console.log(`[pr-summary-worker] Fetching PR data from GitHub...`);
  const [prResponse, filesResponse] = await Promise.all([
    octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: number,
    }),
    octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: number,
      per_page: 100, // Get up to 100 files per page
    }),
  ]);

  const prData = prResponse.data;
  const files = filesResponse.data;

  console.log(`[pr-summary-worker] Fetched PR data:`);
  console.log(`   Title: ${prData.title}`);
  console.log(`   Files: ${files.length}`);
  console.log(`   State: ${prData.state}`);
  console.log(`   Additions: ${prData.additions}, Deletions: ${prData.deletions}`);

  // Map GitHub files to FileChange type for deterministic analysis
  const filesChanged: FileChange[] = files.map((f) => ({
    filename: f.filename,
    additions: f.additions ?? 0,
    deletions: f.deletions ?? 0,
    status: f.status,
    patch: f.patch ?? null,
  }));

  // Return both the filesChanged array and the PR data for use in the worker
  return {
    filesChanged,
    prData,
  };
}

/**
 * Main worker function
 */
async function main() {
  console.log("[pr-summary-worker] Starting PR Summary Worker...");
  
  try {
    // Initialize MongoDB connection
    await initMongo();

    // Create worker
    const worker = new Worker<PrSummaryJobData>(
      "pr-summary",
      async (job: Job<PrSummaryJobData>) => {
        console.log(`[pr-summary-worker] Received job ${job.id} (name: ${job.name}):`, {
          pullRequestId: job.data.pullRequestId,
          repoFullName: job.data.repoFullName,
          number: job.data.number,
        });

        const { pullRequestId } = job.data;
        const PullRequest = getPullRequestModel();

        // Load PR from database
        const pr = await PullRequest.findById(pullRequestId);

        if (!pr) {
          console.warn(`[pr-summary-worker] PR not found: ${pullRequestId}`);
          throw new Error(`PR not found: ${pullRequestId}`);
        }

        // Check if PR is already processed (avoid duplicate work)
        // BUT: if job name is 'regenerate', always process it
        if (job.name !== 'regenerate' && pr.summaryStatus === 'ready' && pr.summary) {
          console.log(`[pr-summary-worker] PR ${pr.repoFullName}#${pr.number} already has a summary, skipping`);
          return;
        }

        try {
          // Update status to processing (optional - you could add a 'processing' status)
          // For now, we'll keep it as 'pending' until it's done

          // Fetch PR data and files from GitHub
          const { filesChanged, prData } = await fetchPRData(job.data);

          // Run deterministic analysis and persist results
          // This happens before LLM so we have labels/risk even if LLM fails
          try {
            console.log(`[pr-summary-worker] Running deterministic analysis...`);
            const deterministic = analyzePullRequestDeterministic({
              filesChanged,
            });

            // Update PR with deterministic analysis results
            await PullRequest.findByIdAndUpdate(
              pullRequestId,
              {
                $set: {
                  systemLabels: deterministic.systemLabels,
                  riskFlags: deterministic.riskFlags,
                  riskScore: deterministic.riskScore,
                  diffStats: deterministic.diffStats,
                },
              },
              { new: true }
            );

            console.log(`[pr-summary-worker] ✅ Deterministic analysis completed:`);
            console.log(`   Labels: ${deterministic.systemLabels.join(", ") || "none"}`);
            console.log(`   Risk flags: ${deterministic.riskFlags.join(", ") || "none"}`);
            console.log(`   Risk score: ${deterministic.riskScore}`);
            console.log(`   Diff stats: +${deterministic.diffStats.totalAdditions} / -${deterministic.diffStats.totalDeletions} (${deterministic.diffStats.changedFilesCount} files)`);
          } catch (deterministicError: any) {
            // Log but don't fail the job if deterministic analysis fails
            console.error(`[pr-summary-worker] ⚠️ Deterministic analysis failed:`, deterministicError.message);
            console.error(`   Stack:`, deterministicError.stack);
            // Continue with summary generation even if deterministic analysis fails
          }

          // Generate summary (stub for now, will be replaced with LLM in Phase 2 & 3)
          const stubSummary: PullRequestSummary = {
            tldr: `Stub summary for PR #${job.data.number}: "${prData.title}". This PR has ${filesChanged.length} file(s) changed with ${prData.additions} additions and ${prData.deletions} deletions.`,
            risks: ["Risk analysis not implemented yet."],
            labels: ["stub-summary"],
            createdAt: new Date(),
          };

          // Update PR with summary
          pr.summary = stubSummary;
          pr.summaryStatus = "ready";
          pr.summaryError = null;
          pr.lastSummarizedAt = new Date();
          await pr.save();

          console.log(`[pr-summary-worker] ✅ Summary updated for PR ${pr.repoFullName}#${pr.number} (ID: ${pullRequestId})`);
        } catch (err: any) {
          console.error(`[pr-summary-worker] ❌ Error summarizing PR ${pr.repoFullName}#${pr.number}:`, err.message);
          console.error(`   Stack:`, err.stack);

          // Update PR with error status
          pr.summaryStatus = "error";
          pr.summaryError = (err?.message || "Unknown error").slice(0, 500); // Limit error message length
          pr.lastSummarizedAt = new Date();
          await pr.save();

          // Re-throw to mark job as failed
          throw err;
        }
      },
      {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 jobs concurrently
      }
    );

    // Worker event handlers
    worker.on("active", (job) => {
      console.log(`[pr-summary-worker] 🔵 Job ${job.id} (${job.name}) is now active`);
    });

    worker.on("completed", (job) => {
      console.log(`[pr-summary-worker] ✅ Job ${job.id} (${job.name}) completed successfully`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[pr-summary-worker] ❌ Job ${job?.id} (${job?.name}) failed:`, err.message);
      if (job?.data) {
        console.error(`   PR ID: ${job.data.pullRequestId}`);
        console.error(`   Repo: ${job.data.repoFullName}#${job.data.number}`);
      }
      console.error(`   Error stack:`, err.stack);
    });

    worker.on("error", (err) => {
      console.error(`[pr-summary-worker] ❌ Worker error:`, err);
      console.error(`   Error stack:`, err.stack);
    });

    worker.on("stalled", (jobId) => {
      console.warn(`[pr-summary-worker] ⚠️  Job ${jobId} stalled`);
    });

    console.log("[pr-summary-worker] ✅ Listening on pr-summary queue");
    console.log("[pr-summary-worker] Ready to process jobs...");
  } catch (error: any) {
    console.error("[pr-summary-worker] ❌ Fatal error:", error);
    console.error("   Stack:", error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[pr-summary-worker] SIGTERM signal received: closing worker");
  await mongoose.connection.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[pr-summary-worker] SIGINT signal received: closing worker");
  await mongoose.connection.close();
  process.exit(0);
});

// Start the worker
main().catch((err) => {
  console.error("[pr-summary-worker] ❌ Fatal error in main:", err);
  process.exit(1);
});


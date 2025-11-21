import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redisConnection } from "../queues/redisConnection";
import { SlackPrNotificationJobData } from "../queues/slackNotifyQueue";
import { sendSlackMessage, SlackWebhookPayload } from "../services/slackClient";

/**
 * Build Slack Block Kit payload from PR notification data
 * 
 * Creates a rich Slack message with:
 * - Header block with PR number and title
 * - Context with repo and author
 * - Risk score and flags section
 * - TL;DR section
 * - Labels context
 * - Action buttons (View on GitHub, optional Open in RepoPulse)
 */
function buildSlackPayload(data: SlackPrNotificationJobData): SlackWebhookPayload {
  const blocks: any[] = [];

  // Header block: PR #<number> · <title>
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `PR #${data.number} · ${data.title}`,
      emoji: true,
    },
  });

  // Context: repo + author
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `📦 ${data.repoFullName} · 👤 ${data.author}`,
      },
    ],
  });

  // Divider
  blocks.push({
    type: "divider",
  });

  // Risk score and flags section
  const riskEmoji = data.riskScore >= 70 ? "🔴" : data.riskScore >= 40 ? "🟡" : "🟢";
  const riskText = `*Risk Score:* ${riskEmoji} ${data.riskScore}/100`;
  
  let riskSectionText = riskText;
  if (data.mainRiskFlags.length > 0) {
    riskSectionText += `\n*Risk Flags:* ${data.mainRiskFlags.join(", ")}`;
  } else {
    riskSectionText += `\n*Risk Flags:* none`;
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: riskSectionText,
    },
  });

  // TL;DR section
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*TL;DR*\n${data.tldr}`,
    },
  });

  // Labels context
  const labelsText = data.systemLabels.length > 0 
    ? data.systemLabels.join(", ") 
    : "none";
  
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `🏷️ *Labels:* ${labelsText}`,
      },
    ],
  });

  // Actions block with buttons
  const actionsElements: any[] = [
    {
      type: "button",
      text: {
        type: "plain_text",
        text: "View on GitHub",
        emoji: true,
      },
      url: data.htmlUrl,
      style: "primary",
    },
  ];

  // Add dashboard button if URL is provided
  if (data.dashboardUrl) {
    actionsElements.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Open in RepoPulse",
        emoji: true,
      },
      url: data.dashboardUrl,
    });
  }

  blocks.push({
    type: "actions",
    elements: actionsElements,
  });

  return {
    text: `PR #${data.number}: ${data.title}`, // Fallback text
    blocks,
  };
}

/**
 * Main worker function
 */
async function main() {
  console.log("[SlackWorker] Starting Slack Notification Worker...");

  try {
    // Create worker
    const worker = new Worker<SlackPrNotificationJobData>(
      "pr-notify-slack",
      async (job: Job<SlackPrNotificationJobData>) => {
        console.log(`[SlackWorker] Received job ${job.id}:`, {
          pullRequestId: job.data.pullRequestId,
          repoFullName: job.data.repoFullName,
          number: job.data.number,
        });

        try {
          // Build Slack payload from job data
          const payload = buildSlackPayload(job.data);

          // Send message to Slack
          await sendSlackMessage(payload);

          console.log(`[SlackWorker] ✅ Slack notification sent for PR ${job.data.repoFullName}#${job.data.number}`);
        } catch (error: any) {
          console.error(`[SlackWorker] ❌ Error processing job ${job.id}:`, error.message);
          console.error(`   Stack:`, error.stack);
          // Re-throw to mark job as failed
          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 jobs concurrently
      }
    );

    // Worker event handlers
    worker.on("active", (job) => {
      console.log(`[SlackWorker] 🔵 Job ${job.id} (${job.name}) is now active`);
    });

    worker.on("completed", (job) => {
      console.log(`[SlackWorker] ✅ Job ${job.id} (${job.name}) completed successfully`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[SlackWorker] ❌ Job ${job?.id} (${job?.name}) failed:`, err.message);
      if (job?.data) {
        console.error(`   PR: ${job.data.repoFullName}#${job.data.number}`);
      }
      console.error(`   Error stack:`, err.stack);
    });

    worker.on("error", (err) => {
      console.error(`[SlackWorker] ❌ Worker error:`, err);
      console.error(`   Error stack:`, err.stack);
    });

    console.log("[SlackWorker] ✅ Listening on pr-notify-slack queue");
    console.log("[SlackWorker] Ready to process jobs...");
  } catch (error: any) {
    console.error("[SlackWorker] ❌ Fatal error:", error);
    console.error("   Stack:", error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[SlackWorker] SIGTERM signal received: closing worker");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[SlackWorker] SIGINT signal received: closing worker");
  process.exit(0);
});

// Start the worker
main().catch((err) => {
  console.error("[SlackWorker] ❌ Fatal error in main:", err);
  process.exit(1);
});


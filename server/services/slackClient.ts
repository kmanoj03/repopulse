import axios from "axios";
import { slackConfig } from "../config/slackConfig";

/**
 * Slack webhook payload structure
 * 
 * Slack Incoming Webhooks accept a JSON payload with:
 * - text: Plain text message (fallback)
 * - blocks: Rich formatting blocks (optional)
 * - attachments: Legacy attachments (optional)
 * - username: Override bot username (optional)
 * - icon_emoji: Override bot icon (optional)
 * 
 * See: https://api.slack.com/messaging/webhooks
 */
export interface SlackWebhookPayload {
  text?: string;
  blocks?: any[];
  attachments?: any[];
  username?: string;
  icon_emoji?: string;
  [key: string]: any; // Allow additional Slack webhook fields
}

/**
 * Send a message to Slack via Incoming Webhook
 * 
 * @param payload - Slack webhook payload (text, blocks, etc.)
 * @returns Promise that resolves when message is sent (or skipped)
 * 
 * Behavior:
 * - If Slack is disabled, logs and returns without sending
 * - If webhook URL is missing, warns and returns without sending
 * - Otherwise, POSTs payload to webhook URL using axios
 * - Catches and logs any errors without throwing
 */
export async function sendSlackMessage(payload: SlackWebhookPayload): Promise<void> {
  // Check if Slack is enabled
  if (!slackConfig.enabled) {
    console.log("[slack-client] Slack notifications are disabled, skipping message");
    return;
  }

  // Check if webhook URL is configured
  if (!slackConfig.webhookUrl) {
    console.warn("[slack-client] Slack is enabled but webhook URL is missing, skipping message");
    return;
  }

  try {
    // Send POST request to Slack webhook
    const response = await axios.post(slackConfig.webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    // Slack returns "ok" on success
    if (response.data === "ok" || response.status === 200) {
      console.log("[slack-client] ✅ Slack message sent successfully");
    } else {
      console.warn("[slack-client] ⚠️ Unexpected response from Slack:", response.data);
    }
  } catch (error) {
    // Log error but don't throw - we don't want to crash the app if Slack is down
    if (axios.isAxiosError(error)) {
      console.error("[slack-client] ❌ Failed to send Slack message:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
    } else {
      console.error("[slack-client] ❌ Failed to send Slack message:", error);
    }
  }
}


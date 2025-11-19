import { Request, Response } from 'express';
import crypto from 'crypto';
import { getPullRequestModel } from '../models/pullRequest.model';

// ============================================
// SIGNATURE VERIFICATION
// ============================================

/**
 * Verifies that the webhook actually came from GitHub
 * Uses HMAC SHA-256 to verify the signature
 * This prevents attackers from sending fake webhook requests
 */
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
  
  if (!secret) {
    console.warn('⚠️  WARNING: No GITHUB_WEBHOOK_SECRET set - skipping verification');
    console.warn('⚠️  This is OK for development, but REQUIRED for production!');
    return true; // Allow in dev, but warn
  }
  
  // Create HMAC using the secret
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature), 
      Buffer.from(digest)
    );
  } catch {
    return false;
  }
}

// ============================================
// MAIN WEBHOOK HANDLER
// ============================================

/**
 * Main entry point for all GitHub webhooks
 * 1. Verifies the signature
 * 2. Parses the event type
 * 3. Routes to appropriate handler
 */
export async function handleGitHubWebhook(req: Request, res: Response) {
  try {
    // ─────────────────────────────────────
    // STEP 1: VERIFY SIGNATURE
    // ─────────────────────────────────────
    const signature = req.headers['x-hub-signature-256'] as string;
    
    if (!signature) {
      console.error('❌ No signature provided in webhook request');
      return res.status(401).json({ error: 'No signature provided' });
    }

    // Convert raw body to string for verification
    const payload = req.body.toString('utf8');
    
    if (!verifySignature(payload, signature)) {
      console.error('❌ Invalid signature - webhook may be from attacker!');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('✅ Signature verified');

    // ─────────────────────────────────────
    // STEP 2: PARSE EVENT
    // ─────────────────────────────────────
    const event = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;
    const webhookData = JSON.parse(payload);
    
    console.log('═══════════════════════════════════════');
    console.log(`📥 Webhook received`);
    console.log(`   Event: ${event}`);
    console.log(`   Delivery ID: ${deliveryId}`);
    console.log(`   Action: ${webhookData.action || 'N/A'}`);
    console.log('═══════════════════════════════════════');

    // ─────────────────────────────────────
    // STEP 3: ROUTE TO HANDLER
    // ─────────────────────────────────────
    if (event === 'pull_request') {
      await handlePullRequestEvent(webhookData);
    } else if (event === 'ping') {
      console.log('🏓 Received ping event - webhook is configured correctly!');
    } else {
      console.log(`ℹ️  Ignoring ${event} event (not configured to handle it)`);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ 
      message: 'Webhook processed successfully',
      event,
      deliveryId
    });

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================
// PULL REQUEST EVENT HANDLER
// ============================================

/**
 * Handles pull_request events from GitHub
 * Actions: opened, reopened, synchronize, closed
 * 
 * What this does:
 * 1. Extracts PR data from webhook payload
 * 2. Determines PR status (open/closed/merged)
 * 3. Upserts PR document to MongoDB
 * 4. (Later) Will enqueue job for AI analysis
 */
async function handlePullRequestEvent(data: any) {
  const action = data.action; // opened, closed, synchronize, reopened, etc.
  const pr = data.pull_request;
  const repo = data.repository;
  const installation = data.installation;

  console.log(`\n📝 Processing PR Event:`);
  console.log(`   Repository: ${repo.full_name}`);
  console.log(`   PR #${pr.number}: ${pr.title}`);
  console.log(`   Author: ${pr.user.login}`);
  console.log(`   Action: ${action}`);

  // ─────────────────────────────────────
  // FILTER: Only process relevant actions
  // ─────────────────────────────────────
  const relevantActions = ['opened', 'reopened', 'synchronize', 'closed'];
  if (!relevantActions.includes(action)) {
    console.log(`ℹ️  Ignoring action: ${action} (not in our filter list)`);
    return;
  }

  // ─────────────────────────────────────
  // DETERMINE STATUS
  // ─────────────────────────────────────
  let status = 'open';
  if (pr.state === 'closed' && pr.merged) {
    status = 'merged';
  } else if (pr.state === 'closed') {
    status = 'closed';
  }

  console.log(`   Status: ${status}`);

  // ─────────────────────────────────────
  // PREPARE PR DATA
  // ─────────────────────────────────────
  const prData = {
    repoId: repo.id.toString(),
    repoFullName: repo.full_name,
    number: pr.number,
    title: pr.title,
    author: pr.user.login,
    branchFrom: pr.head.ref,
    branchTo: pr.base.ref,
    status: status,
    filesChanged: [], // Will be populated by worker (Section 1B)
    summary: {
      tldr: 'Pending analysis...', // Placeholder until worker processes it
      risks: [],
      labels: [],
      createdAt: new Date(),
    },
    slackMessageTs: null,
  };

  // ─────────────────────────────────────
  // UPSERT TO MONGODB (Idempotent)
  // ─────────────────────────────────────
  const PullRequest = getPullRequestModel();
  
  try {
    const upsertedPR = await PullRequest.findOneAndUpdate(
      { repoId: repo.id.toString(), number: pr.number }, // Find by unique combo
      prData, // Update with this data
      { 
        upsert: true,  // Create if doesn't exist
        new: true,     // Return the updated document
        setDefaultsOnInsert: true
      }
    );

    console.log(`✅ Upserted PR to MongoDB`);
    console.log(`   MongoDB _id: ${upsertedPR._id}`);
    console.log(`   Repo: ${upsertedPR.repoFullName}`);
    console.log(`   PR #${upsertedPR.number}`);

    // ─────────────────────────────────────
    // ENQUEUE JOB (Coming in next step)
    // ─────────────────────────────────────
    // Only enqueue for actions that need analysis
    if (['opened', 'reopened', 'synchronize'].includes(action)) {
      console.log(`\n📤 TODO: Enqueue summarize job for PR #${pr.number}`);
      console.log(`   (This will be implemented when we add Redis/BullMQ)`);
      
      // PLACEHOLDER for next step:
      // await enqueueSummarizeJob({
      //   repoId: repo.id.toString(),
      //   repoFullName: repo.full_name,
      //   prNumber: pr.number,
      //   installationId: installation.id,
      //   prId: upsertedPR._id.toString(),
      // });
    }

    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error upserting PR to MongoDB:', error);
    throw error;
  }
}



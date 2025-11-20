import express from 'express';
import crypto from 'crypto';
import {
  handleInstallationCreated,
  handleInstallationDeleted,
  handleInstallationRepositoriesAdded,
  handleInstallationRepositoriesRemoved,
  handlePROpened,
  handlePRSynchronized,
  handlePRClosed,
  handlePRReopened,
} from '../handlers/webhookHandler';

const router = express.Router();

// ============================================
// SIGNATURE VERIFICATION MIDDLEWARE
// ============================================

function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
  
  if (!secret) {
    console.warn('⚠️  WARNING: No GITHUB_WEBHOOK_SECRET set - skipping verification');
    return true;
  }
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

// ============================================
// MAIN WEBHOOK HANDLER
// ============================================

router.post('/github', async (req, res) => {
  try {
    // Verify signature
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      return res.status(401).json({ error: 'No signature provided' });
    }

    const payload = req.body.toString('utf8');
    if (!verifySignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse event
    const event = req.headers['x-github-event'] as string;
    const webhookData = JSON.parse(payload);
    const action = webhookData.action;

    console.log(`📥 Webhook: ${event}.${action || 'N/A'}`);

    // Route to appropriate handler
    if (event === 'installation') {
      if (action === 'created') {
        await handleInstallationCreated({ ...req, body: webhookData } as any, res);
      } else if (action === 'deleted') {
        await handleInstallationDeleted({ ...req, body: webhookData } as any, res);
      } else {
        res.status(200).json({ message: 'Event ignored' });
      }
    } else if (event === 'installation_repositories') {
      if (action === 'added') {
        await handleInstallationRepositoriesAdded({ ...req, body: webhookData } as any, res);
      } else if (action === 'removed') {
        await handleInstallationRepositoriesRemoved({ ...req, body: webhookData } as any, res);
      } else {
        res.status(200).json({ message: 'Event ignored' });
      }
    } else if (event === 'pull_request') {
      if (action === 'opened') {
        await handlePROpened({ ...req, body: webhookData } as any, res);
      } else if (action === 'synchronize' || action === 'edited') {
        // Handle both new commits and edits (title/description changes)
        await handlePRSynchronized({ ...req, body: webhookData } as any, res);
      } else if (action === 'closed') {
        await handlePRClosed({ ...req, body: webhookData } as any, res);
      } else if (action === 'reopened') {
        await handlePRReopened({ ...req, body: webhookData } as any, res);
      } else {
        res.status(200).json({ message: 'Event ignored' });
      }
    } else if (event === 'ping') {
      res.status(200).json({ message: 'Pong! Webhook configured successfully' });
    } else {
      res.status(200).json({ message: 'Event not handled' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Optional: GET endpoint to test if webhook route is working
router.get('/github', (req, res) => {
  res.json({ 
    message: 'GitHub webhook endpoint is active',
    method: 'POST',
    note: 'This endpoint receives webhooks from GitHub App'
  });
});

export default router;



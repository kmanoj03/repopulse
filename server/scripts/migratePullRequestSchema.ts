/**
 * Migration script to update existing PullRequest documents in MongoDB
 * 
 * CHANGES MADE TO PULLREQUEST MODEL:
 * ===================================
 * 
 * 1. Summary Field Changes:
 *    - Changed from required to nullable (summary: PullRequestSummary | null)
 *    - Summary is now null when PR is first created
 *    - Summary is populated when AI analysis completes
 * 
 * 2. New Fields Added:
 *    - summaryStatus: "pending" | "ready" | "error" (default: "pending")
 *      * "pending" - Summary not yet generated
 *      * "ready" - Summary successfully generated
 *      * "error" - Summary generation failed
 * 
 *    - summaryError: string | null (default: null)
 *      * Stores error message if summary generation fails
 * 
 *    - lastSummarizedAt: Date | null (default: null)
 *      * Timestamp of when summary was last generated/updated
 * 
 * 3. Handler Updates:
 *    - Webhook handlers now create PRs with summary: null, summaryStatus: "pending"
 *    - Regenerate handler resets summary to null and status to "pending"
 * 
 * 4. Frontend Updates:
 *    - PRCard and PRDetailPage now handle nullable summary
 *    - Shows "Summary pending..." or "Summary error" states
 *    - Only displays summary content when summaryStatus === "ready"
 * 
 * IMPORTANT: Only run this script when you're ready to migrate existing data.
 * Run with: npm run migrate (or tsx scripts/migratePullRequestSchema.ts)
 * 
 * The script is idempotent - safe to run multiple times.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getPullRequestModel } from '../models/pullRequest.model';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/repopulse';

async function migratePullRequestSchema() {
  try {
    console.log('🔵 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const PullRequest = getPullRequestModel();
    
    // Get all PRs that need migration
    const prs = await PullRequest.find({}).lean();
    console.log(`📊 Found ${prs.length} pull request(s) to migrate`);

    let updated = 0;
    let skipped = 0;

    for (const pr of prs) {
      const updates: any = {};
      let needsUpdate = false;

      // 1. Set summaryStatus if not present
      if (!pr.summaryStatus) {
        // If summary exists and has data, mark as ready
        if (pr.summary && pr.summary.tldr) {
          updates.summaryStatus = 'ready';
        } else {
          updates.summaryStatus = 'pending';
        }
        needsUpdate = true;
      }

      // 2. Set summaryError if not present (default to null)
      if (pr.summaryError === undefined) {
        updates.summaryError = null;
        needsUpdate = true;
      }

      // 3. Set lastSummarizedAt if not present
      if (!pr.lastSummarizedAt) {
        // If summary exists, use its createdAt, otherwise null
        if (pr.summary && pr.summary.createdAt) {
          updates.lastSummarizedAt = pr.summary.createdAt;
        } else {
          updates.lastSummarizedAt = null;
        }
        needsUpdate = true;
      }

      // 4. Convert summary to null if it's empty/invalid
      if (pr.summary && (!pr.summary.tldr || pr.summary.tldr.trim() === '')) {
        updates.summary = null;
        if (!updates.summaryStatus) {
          updates.summaryStatus = 'pending';
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        await PullRequest.updateOne(
          { _id: pr._id },
          { $set: updates }
        );
        updated++;
        console.log(`   ✅ Updated PR ${pr.repoFullName}#${pr.number}`);
      } else {
        skipped++;
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('Migration Summary:');
    console.log(`   Total PRs: ${prs.length}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (already up to date): ${skipped}`);
    console.log('═══════════════════════════════════════\n');

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔵 MongoDB connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePullRequestSchema()
    .then(() => {
      console.log('✅ Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script error:', error);
      process.exit(1);
    });
}

export { migratePullRequestSchema };


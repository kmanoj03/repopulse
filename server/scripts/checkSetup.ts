#!/usr/bin/env tsx

/**
 * Startup Check Script
 * Run this before starting the server to verify your setup
 * Usage: npm run check-setup
 */

import dotenv from 'dotenv';
import fs from 'fs';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const checks: CheckResult[] = [];

function addCheck(name: string, status: 'pass' | 'fail' | 'warn', message: string) {
  checks.push({ name, status, message });
}

async function runChecks() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         RepoPulse Setup Verification                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 1. Check MongoDB URI
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      addCheck('MongoDB Connection', 'pass', `Connected to ${mongoUri}`);
      await mongoose.disconnect();
    } catch (error: any) {
      addCheck('MongoDB Connection', 'fail', `Failed to connect: ${error.message}`);
    }
  } else {
    addCheck('MongoDB Connection', 'fail', 'MONGODB_URI not set in .env');
  }

  // 2. Check GitHub App ID
  if (process.env.GITHUB_APP_ID) {
    addCheck('GitHub App ID', 'pass', `Set: ${process.env.GITHUB_APP_ID}`);
  } else {
    addCheck('GitHub App ID', 'fail', 'GITHUB_APP_ID not set in .env');
  }

  // 3. Check GitHub Private Key
  const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (privateKeyPath) {
    if (fs.existsSync(privateKeyPath)) {
      const stat = fs.statSync(privateKeyPath);
      if (stat.size > 0) {
        addCheck('GitHub Private Key', 'pass', `File found: ${privateKeyPath} (${stat.size} bytes)`);
      } else {
        addCheck('GitHub Private Key', 'fail', `File is empty: ${privateKeyPath}`);
      }
    } else {
      addCheck('GitHub Private Key', 'fail', `File not found: ${privateKeyPath}`);
    }
  } else {
    addCheck('GitHub Private Key', 'fail', 'GITHUB_PRIVATE_KEY_PATH not set in .env');
  }

  // 4. Check GitHub OAuth Client ID
  if (process.env.GITHUB_CLIENT_ID) {
    addCheck('GitHub OAuth Client ID', 'pass', `Set: ${process.env.GITHUB_CLIENT_ID}`);
  } else {
    addCheck('GitHub OAuth Client ID', 'fail', 'GITHUB_CLIENT_ID not set in .env');
  }

  // 5. Check GitHub OAuth Client Secret
  if (process.env.GITHUB_CLIENT_SECRET) {
    const secret = process.env.GITHUB_CLIENT_SECRET;
    addCheck('GitHub OAuth Client Secret', 'pass', `Set: ${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`);
  } else {
    addCheck('GitHub OAuth Client Secret', 'fail', 'GITHUB_CLIENT_SECRET not set in .env');
  }

  // 6. Check JWT Secret
  if (process.env.JWT_SECRET) {
    const length = process.env.JWT_SECRET.length;
    if (length >= 32) {
      addCheck('JWT Secret', 'pass', `Set (${length} characters)`);
    } else {
      addCheck('JWT Secret', 'warn', `Set but short (${length} characters). Recommended: 32+`);
    }
  } else {
    addCheck('JWT Secret', 'fail', 'JWT_SECRET not set in .env');
  }

  // 7. Check optional environment variables
  const port = process.env.PORT || '3000';
  addCheck('Server Port', 'pass', port);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  addCheck('Frontend URL', process.env.FRONTEND_URL ? 'pass' : 'warn', frontendUrl);

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  addCheck('Backend URL', process.env.BACKEND_URL ? 'pass' : 'warn', backendUrl);

  if (process.env.GITHUB_WEBHOOK_SECRET) {
    addCheck('GitHub Webhook Secret', 'pass', 'Set');
  } else {
    addCheck('GitHub Webhook Secret', 'warn', 'Not set (webhooks won\'t be verified)');
  }

  // Print results
  console.log('Check Results:\n');
  
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  checks.forEach((check) => {
    let icon = '';
    let color = '';
    
    if (check.status === 'pass') {
      icon = '✅';
      passCount++;
    } else if (check.status === 'fail') {
      icon = '❌';
      failCount++;
    } else {
      icon = '⚠️ ';
      warnCount++;
    }

    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.message}\n`);
  });

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('Summary:');
  console.log(`  ✅ Passed: ${passCount}`);
  console.log(`  ⚠️  Warnings: ${warnCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failCount > 0) {
    console.log('❌ Setup incomplete. Please fix the failed checks above.');
    console.log('   See server/SETUP_GUIDE.md for detailed instructions.\n');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('⚠️  Setup complete with warnings. Server should work but check warnings above.\n');
    process.exit(0);
  } else {
    console.log('✅ All checks passed! Your server is ready to run.');
    console.log('   Start with: npm run dev\n');
    process.exit(0);
  }
}

runChecks().catch((error) => {
  console.error('Error running checks:', error);
  process.exit(1);
});


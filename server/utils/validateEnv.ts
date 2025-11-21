/**
 * Validates that all required environment variables are set
 * Call this at server startup to fail fast with helpful error messages
 */

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const required = [
    'MONGODB_URI',
    'GITHUB_APP_ID',
    'GITHUB_PRIVATE_KEY_PATH',
    'JWT_SECRET',
  ];
  
  // OAuth credentials: Either GitHub App OAuth (preferred) or OAuth App (fallback)
  const hasGitHubAppOAuth = process.env.GITHUB_APP_CLIENT_ID && process.env.GITHUB_APP_CLIENT_SECRET;
  const hasOAuthApp = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET;
  
  if (!hasGitHubAppOAuth && !hasOAuthApp) {
    // Add to required if neither is set
    required.push('GITHUB_APP_CLIENT_ID (or GITHUB_CLIENT_ID)');
    required.push('GITHUB_APP_CLIENT_SECRET (or GITHUB_CLIENT_SECRET)');
  }

  const optional = [
    'PORT',
    'FRONTEND_URL',
    'BACKEND_URL',
    'GITHUB_WEBHOOK_SECRET',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'GEMINI_API_KEY',
    'GEMINI_MODEL',
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  // Check OAuth credentials and add warning if using OAuth App instead of GitHub App OAuth
  if (hasOAuthApp && !hasGitHubAppOAuth) {
    warnings.push('Using OAuth App credentials - consider switching to GitHub App OAuth (GITHUB_APP_CLIENT_ID) to enable /user/installations check');
  }

  // Check optional but recommended variables
  for (const envVar of optional) {
    if (!process.env[envVar]) {
      warnings.push(envVar);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

export function printEnvValidation(): boolean {
  const result = validateEnvironment();

  console.log('\n═══════════════════════════════════════');
  console.log('Environment Variable Validation');
  console.log('═══════════════════════════════════════\n');

  if (result.valid) {
    console.log('✅ All required environment variables are set\n');

    if (result.warnings.length > 0) {
      console.log('⚠️  Optional variables not set (using defaults):');
      result.warnings.forEach((envVar) => {
        console.log(`   - ${envVar}`);
      });
      console.log('');
    }

    // Show current configuration
    console.log('📋 Current Configuration:');
    console.log(`   MongoDB: ${process.env.MONGODB_URI}`);
    console.log(`   Port: ${process.env.PORT || 3000}`);
    console.log(`   GitHub App ID: ${process.env.GITHUB_APP_ID}`);
    console.log(`   Private Key: ${process.env.GITHUB_PRIVATE_KEY_PATH}`);
    console.log(`   GitHub App OAuth Client ID: ${process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID || 'NOT SET'}`);
    if (process.env.GITHUB_APP_CLIENT_ID) {
      console.log(`   ✅ Using GitHub App OAuth (can check /user/installations)`);
    } else if (process.env.GITHUB_CLIENT_ID) {
      console.log(`   ⚠️  Using OAuth App (cannot check /user/installations - will fallback to manual install)`);
    }
    console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`   Backend URL: ${process.env.BACKEND_URL || 'http://localhost:3000'}`);
    console.log(`   Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Enabled' : '⚠️  Disabled (no API key)'}`);
    if (process.env.GEMINI_API_KEY) {
      console.log(`   Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
    }
    console.log('');

    return true;
  } else {
    console.log('❌ Missing required environment variables:\n');
    result.missing.forEach((envVar) => {
      console.log(`   ❌ ${envVar}`);
    });
    console.log('\n');
    console.log('Please set these variables in your .env file');
    console.log('See .env.example for reference\n');
    console.log('═══════════════════════════════════════\n');

    return false;
  }
}


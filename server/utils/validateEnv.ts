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
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'JWT_SECRET',
  ];

  const optional = [
    'PORT',
    'FRONTEND_URL',
    'BACKEND_URL',
    'GITHUB_WEBHOOK_SECRET',
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
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
    console.log(`   OAuth Client ID: ${process.env.GITHUB_CLIENT_ID}`);
    console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`   Backend URL: ${process.env.BACKEND_URL || 'http://localhost:3000'}`);
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


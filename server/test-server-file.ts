// Test file for deterministic analysis - backend detection
// This file should trigger "backend" label

import express from 'express';

export function testBackendFunction() {
  console.log('This is a test backend file');
  return 'backend';
}

// fake test key: ghp_123456789012345678901234567890123456
// This should trigger secrets-suspected flag


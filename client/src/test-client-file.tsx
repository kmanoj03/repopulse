// Test file for deterministic analysis - frontend detection
// This file should trigger "frontend" label

import React from 'react';

export function TestClientComponent() {
  return (
    <div className="test-component">
      <h1>This is a test frontend file</h1>
    </div>
  );
}


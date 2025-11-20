#!/bin/bash

# RepoPulse Server Startup Script
# This ensures only one instance runs

echo "🔧 Checking for existing server processes..."

# Kill any existing processes
pkill -f "npm run dev" 2>/dev/null
pkill -f "tsx watch server.ts" 2>/dev/null
sleep 1

# Kill anything on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

# Verify port is free
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "❌ Port 3000 is still busy!"
    echo "   Run: lsof -ti:3000 | xargs kill -9"
    exit 1
fi

echo "✅ Port 3000 is free"
echo "🚀 Starting server..."
echo ""

# Start the server
cd "$(dirname "$0")"
npm run dev 2>&1 | tee /tmp/repopulse-server.log


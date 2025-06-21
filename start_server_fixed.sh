#!/bin/bash

# Set up environment
export PATH="/opt/homebrew/bin:$PATH"

# Go to server directory
cd /Users/johnbreau/Desktop/DesktopFolder/Areas/Coding/mcp-server/server

# Start the development server
echo "Starting development server..."
npm run dev

#!/bin/bash

# Set up environment
export PATH="/opt/homebrew/bin:$PATH"

# Install server dependencies
echo "Installing server dependencies..."
cd server
npm install -D tsx typescript ts-node @types/node

# Install root dependencies
echo "Installing root dependencies..."
cd ..
npm install

# Start the development server
echo "Starting development server..."
npm run dev

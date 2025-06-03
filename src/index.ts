// src/index.ts
import * as dotenv from 'dotenv';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import express from 'express';
import cors from 'cors';
import toolRouter from './router.js';
import aiRouter from './routes/ai.js';

// Add error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Application specific logging, throwing an error, or other logic here
});

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
console.log('Current working directory:', process.cwd());
console.log('Loading environment variables from:', envPath);

// Debug: Check if file exists and is readable
try {
  await fs.access(envPath, fs.constants.R_OK);
  console.log('.env file exists and is readable');
  
  // Load environment variables
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('Environment variables loaded successfully');
    console.log('Available environment variables:', Object.keys(process.env).join(', '));
  }
} catch (err) {
  console.error('Error accessing .env file:', err);
  console.log('Falling back to process.env for environment variables');
  
  // Try to load without path as fallback
  dotenv.config();
}

// Debug log environment variables
console.log('Environment variables after loading:');
console.log('- OBSIDIAN_VAULT_PATH:', process.env.OBSIDIAN_VAULT_PATH || 'Not set');
console.log('- PORT:', process.env.PORT || '3000 (default)');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '*** (exists)' : 'NOT FOUND');

const app = express();

// Enable CORS for development
const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Log all requests
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use("/api/tools", toolRouter);
app.use("/api/ai", aiRouter);

// Add a test endpoint
app.get('/api/test', (_req, res) => {
  res.json({
    message: 'Test endpoint is working',
    obsidianPath: process.env.OBSIDIAN_VAULT_PATH,
    env: process.env.NODE_ENV
  });
});

app.get('/api/env-test', async (_req, res) => {
  try {
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '';
    let vaultExists = false;
    
    if (vaultPath) {
      try {
        await fs.access(vaultPath);
        vaultExists = true;
      } catch (error) {
        vaultExists = false;
      }
    }
    
    res.json({
      vaultPath,
      vaultExists
    });
  } catch (error) {
    console.error('Error in /api/env-test:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔌 MCP server running at http://localhost:${PORT}`);
  console.log(`- OBSIDIAN_VAULT_PATH: ${process.env.OBSIDIAN_VAULT_PATH || 'Not set!'}`);
});
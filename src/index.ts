// src/index.ts
import * as dotenv from 'dotenv';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import express from 'express';
import cors from 'cors';
import toolRouter from './router.js';
import aiRouter from './routes/ai.js';
import timelineRouter from './routes/timeline.js';

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

// Wrap the main code in an async IIFE to handle top-level await
(async () => {
  try {
    // Debug: Check if file exists and is readable
    await fs.access(envPath, fs.constants.R_OK);
    console.log('.env file exists and is readable');
    
    // Load environment variables
    const result = dotenv.config({ path: envPath, override: true });
    
    if (result.error) {
      console.error('Error loading .env file:', result.error);
      throw result.error;
    } else {
      console.log('Environment variables loaded successfully');
      // Only log non-sensitive environment variable names
      const envVars = Object.keys(process.env).filter(key => !key.toLowerCase().includes('key') && !key.toLowerCase().includes('secret'));
      console.log('Available environment variables:', envVars.join(', '));
      
      // Verify required environment variables
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set in the .env file');
      }
      if (!process.env.OBSIDIAN_VAULT_PATH) {
        throw new Error('OBSIDIAN_VAULT_PATH is not set in the .env file');
      }
    }
  } catch (err) {
    console.error('Error accessing .env file:', err);
    console.log('Falling back to process.env for environment variables');
    
    // Try to load without path as fallback
    dotenv.config();
    
    // Verify required environment variables
    if (!process.env.OPENAI_API_KEY) {
      console.error('ERROR: OPENAI_API_KEY is not set in environment variables');
      process.exit(1);
    }
    if (!process.env.OBSIDIAN_VAULT_PATH) {
      console.error('ERROR: OBSIDIAN_VAULT_PATH is not set in environment variables');
      process.exit(1);
    }
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

  // Debug: Log all registered routes before mounting
  console.log('Mounting routers...');
  
  // Mount routers
  app.use('/api/tools', toolRouter);
  console.log('- Mounted /api/tools router');
  
  // Mount AI router with debug logging
  console.log('Mounting AI router at /api/ai');
  
  // Add a test route before the router
  app.get('/api/ai/health', (_req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'AI router is working'
    });
  });
  
  // Mount the AI router
  app.use('/api/ai', (req, res, next) => {
    console.log(`[${new Date().toISOString()}] AI Router hit: ${req.method} ${req.path}`);
    next();
  }, aiRouter);
  
  console.log('- Mounted /api/ai router with middleware');
  
  app.use('/api/timeline', timelineRouter);
  console.log('- Mounted /api/timeline router');
  
  // Debug: Log all routes after mounting
  console.log('All mounted routes:');
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      // Routes registered directly on the app
      console.log(`- ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      // Router middleware
      console.log(`- Router mounted at: ${middleware.regexp}`);
      // Log routes for this router
      middleware.handle.stack.forEach((handler: any) => {
        const route = handler.route;
        if (route) {
          console.log(`  ${Object.keys(route.methods).join(', ').toUpperCase()} ${route.path}`);
        }
      });
    }
  });

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
})();
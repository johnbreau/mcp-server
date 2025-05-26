// src/index.ts
import express from "express";
import dotenv from "dotenv";
import path from 'path';
import * as fs from 'fs';
import toolRouter from "./router";

// Load environment variables
dotenv.config();

// Debug log environment variables
console.log('Environment variables:');
console.log('- OBSIDIAN_VAULT_PATH:', process.env.OBSIDIAN_VAULT_PATH);
console.log('- PORT:', process.env.PORT);
console.log('Current working directory:', process.cwd());
console.log('Environment file:', path.resolve(process.cwd(), '.env'));

const app = express();

// Log all requests
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());
app.use("/", toolRouter);

// Add a test endpoint
app.get('/api/test', (_req, res) => {
  res.json({
    message: 'Test endpoint is working',
    obsidianPath: process.env.OBSIDIAN_VAULT_PATH,
    env: process.env.NODE_ENV
  });
});

app.get('/api/env-test', (_req, res) => {
  res.json({
    vaultPath: process.env.OBSIDIAN_VAULT_PATH,
    vaultExists: fs.existsSync(process.env.OBSIDIAN_VAULT_PATH || '')
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔌 MCP server running at http://localhost:${PORT}`);
  console.log(`- OBSIDIAN_VAULT_PATH: ${process.env.OBSIDIAN_VAULT_PATH || 'Not set!'}`);
});
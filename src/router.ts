// src/router.ts
import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const toolsDir = path.join(__dirname, 'tools');

// Handle preflight requests
router.options('*', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(204).end();
});

// Helper function to handle tool execution
const executeTool = async (toolName: string, input: any, res: Response): Promise<void> => {
  const toolPath = path.join(toolsDir, `${toolName}.ts`);
  
  if (!fs.existsSync(toolPath)) {
    res.status(404).json({ error: `Tool not found: ${toolName}` });
    return;
  }

  try {
    const toolModule = require(toolPath);
    const tool = toolModule.default;

    if (!tool?.run) {
      throw new Error(`Invalid tool: ${toolName}`);
    }

    const result = await tool.run(input);
    res.json(result);
  } catch (error) {
    console.error('Tool execution error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error instanceof Error ? error.stack : undefined 
      })
    });
  }
};

// Register tool routes
router.get('/:tool', (req: Request, res: Response, next: NextFunction) => {
  const toolName = req.params.tool;
  if (!toolName) {
    res.status(400).json({ error: 'No tool specified' });
    return;
  }

  console.log(`[${new Date().toISOString()}] GET /api/tools/${toolName}`, { input: req.query });
  executeTool(toolName, req.query, res).catch(next);
});

// POST handler
router.post('/:tool', (req: Request, res: Response, next: NextFunction) => {
  const toolName = req.params.tool;
  if (!toolName) {
    res.status(400).json({ error: 'No tool specified' });
    return;
  }

  console.log(`[${new Date().toISOString()}] POST /api/tools/${toolName}`, { input: req.body });
  executeTool(toolName, req.body, res).catch(next);
});

export default router;
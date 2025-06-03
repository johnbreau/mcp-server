// src/router.ts
import { Router, type Request, type Response, type NextFunction } from 'express';

const router = Router();

// Log the current working directory for debugging
console.log('Current working directory:', process.cwd());

// Add error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle preflight requests
router.options('*', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(204).end();
});

// Helper function to handle tool execution
const executeTool = async (toolName: string, input: any, res: Response): Promise<void> => {
  console.log(`\n=== Executing tool: ${toolName} ===`);
  console.log('Input:', JSON.stringify(input, null, 2));
  
  try {
    console.log(`Attempting to load tool: ${toolName}`);
    
    // Use the tool loader
    const { loadTool } = await import('./tools/loader.js');
    const tool = await loadTool(toolName);
    console.log(`Successfully loaded tool: ${toolName}`);
    
    if (!tool || typeof tool.run !== 'function') {
      throw new Error(`Tool ${toolName} does not export a valid run function`);
    }
    
    // Execute the tool
    const result = await tool.run(input);
    console.log('Tool execution result:', result);
    
    // Send success response
    res.json({
      success: true,
      data: result,
      tool: toolName
    });
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Cannot find module')) {
        res.status(404).json({
          error: 'Tool not found',
          message: `The tool '${toolName}' could not be found or loaded`,
          tool: toolName
        });
        return;
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          tool: toolName,
          details: (error as any).details
        });
        return;
      }
    }
    
    // Generic error response
    res.status(500).json({
      error: 'Tool execution failed',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      tool: toolName,
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    });
  }
};

// Register tool routes
export const handleToolRequest = async (req: Request, res: Response, next: NextFunction) => {
  const toolName = req.params.tool;
  const input = req.method === 'GET' ? req.query : req.body;
  
  if (!toolName) {
    return res.status(400).json({
      error: 'Tool name is required',
      message: 'Please provide a tool name in the URL path (e.g., /api/tools/obsidian)'
    });
  }
  
  // Log the request
  console.log(`[${new Date().toISOString()}] ${req.method} /api/tools/${toolName}`);
  console.log('Input:', JSON.stringify(input, null, 2));
  
  try {
    await executeTool(toolName, input, res);
    return;
  } catch (error) {
    console.error(`Error in handleToolRequest for ${toolName}:`, error);
    next(error);
    return; // Ensure we don't continue execution after calling next()
  }
};

// GET /api/tools/:tool
router.get('/:tool', handleToolRequest);

// POST /api/tools/:tool
router.post('/:tool', handleToolRequest);

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
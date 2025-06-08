import { Router } from 'express';
import timelineRouter from './routes/timeline.js';
const router = Router();
router.use('/timeline', timelineRouter);
console.log('Current working directory:', process.cwd());
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
router.options('*', (_req, res) => {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
});
const executeTool = async (toolName, input, res) => {
    console.log(`\n=== Executing tool: ${toolName} ===`);
    console.log('Input:', JSON.stringify(input, null, 2));
    try {
        console.log(`Attempting to load tool: ${toolName}`);
        const { loadTool } = await import('./tools/loader.js');
        const tool = await loadTool(toolName);
        console.log(`Successfully loaded tool: ${toolName}`);
        if (!tool || typeof tool.run !== 'function') {
            throw new Error(`Tool ${toolName} does not export a valid run function`);
        }
        const result = await tool.run(input);
        console.log('Tool execution result:', result);
        res.json({
            success: true,
            data: result,
            tool: toolName
        });
    }
    catch (error) {
        console.error(`Error executing tool ${toolName}:`, error);
        if (error instanceof Error) {
            if (error.message.includes('Cannot find module')) {
                res.status(404).json({
                    error: 'Tool not found',
                    message: `The tool '${toolName}' could not be found or loaded`,
                    tool: toolName
                });
                return;
            }
            if (error.name === 'ValidationError') {
                res.status(400).json({
                    error: 'Validation Error',
                    message: error.message,
                    tool: toolName,
                    details: error.details
                });
                return;
            }
        }
        res.status(500).json({
            error: 'Tool execution failed',
            message: error instanceof Error ? error.message : 'An unknown error occurred',
            tool: toolName,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
export const handleToolRequest = async (req, res, next) => {
    const toolName = req.params.tool;
    const input = req.method === 'GET' ? req.query : req.body;
    if (!toolName) {
        return res.status(400).json({
            error: 'Tool name is required',
            message: 'Please provide a tool name in the URL path (e.g., /api/tools/obsidian)'
        });
    }
    console.log(`[${new Date().toISOString()}] ${req.method} /api/tools/${toolName}`);
    console.log('Input:', JSON.stringify(input, null, 2));
    try {
        await executeTool(toolName, input, res);
        return;
    }
    catch (error) {
        console.error(`Error in handleToolRequest for ${toolName}:`, error);
        next(error);
        return;
    }
};
router.get('/:tool', handleToolRequest);
router.post('/:tool', handleToolRequest);
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
export default router;
//# sourceMappingURL=router.js.map
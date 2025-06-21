import { Router, Request, Response, NextFunction } from 'express';
import { AIService } from '../services/aiService';

const router = Router();

// Initialize AI Service
const aiService = new AIService();

// Chat handler
const chatHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ 
        success: false, 
        error: 'Messages array is required' 
      });
      return;
    }

    console.log('Processing chat request with messages:', messages);
    
    // Process the chat messages
    const response = await aiService.chatCompletion(messages);
    
    res.json({
      success: true,
      response: response
    });
  } catch (error) {
    console.error('Error in chat handler:', error);
    next(error);
  }
  return;
};

// Register route handlers
router.post('/chat', chatHandler);

// Test endpoint
router.get('/test', (_req: Request, res: Response) => {
  res.json({ 
    success: true, 
    message: 'AI router is working',
    timestamp: new Date().toISOString()
  });
});

// Debug: Log all registered routes
console.log('AI Routes registered:');
interface RouteLayer {
  route?: {
    path: string;
    methods: { [method: string]: boolean };
  };
}

(router.stack as RouteLayer[]).forEach((layer) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods || {})
      .filter(m => m !== '_all')
      .map(m => m.toUpperCase())
      .join(', ');
    console.log(`- ${methods} ${layer.route.path}`);
  }
});

export default router;

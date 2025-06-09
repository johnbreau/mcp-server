import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import goodreadsRoutes from './routes/goodreads.js';
import timelineRoutes from './routes/timeline.js';
import calendarRoutes from './routes/calendar.js';
import obsidianRoutes from './routes/obsidian.js';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

console.log('Environment variables loaded from:', envPath);
console.log('OBSIDIAN_VAULT_PATH:', process.env.OBSIDIAN_VAULT_PATH || 'Not set');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api/books', goodreadsRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/tools/obsidian', obsidianRoutes);

// Log all registered routes
const printRoutes = () => {
  const routes: string[] = [];
  const stack = app._router.stack as Array<{
    route?: { path: string; methods: { [method: string]: boolean } };
    name?: string;
    handle?: {
      stack?: Array<{
        route?: { path: string; methods: { [method: string]: boolean } };
      }>;
    };
  }>;
  
  stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the app
      const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
      routes.push(`${methods.padEnd(7)} ${middleware.route.path}`);
    } else if (middleware.name === 'router' && middleware.handle?.stack) {
      // Routes registered via app.use()
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
          routes.push(`${methods.padEnd(7)} /api${handler.route.path}`);
        }
      });
    }
  });
  
  console.log('\nRegistered Routes:');
  console.log(routes.join('\n'));
};

// Print routes after server starts
setImmediate(printRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;

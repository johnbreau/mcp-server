import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import goodreadsRoutes from './routes/goodreads';
import timelineRoutes from './routes/timeline';
import calendarRoutes from './routes/calendar';

dotenv.config();

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

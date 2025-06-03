import * as dotenv from 'dotenv';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import express from 'express';
import cors from 'cors';
import toolRouter from './router.js';
import aiRouter from './routes/ai.js';
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading environment variables from:', envPath);
console.log('Current working directory:', process.cwd());
try {
    dotenv.config({ path: envPath });
    console.log('Environment variables loaded successfully');
    console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '*** (exists)' : 'NOT FOUND');
}
catch (error) {
    console.error('Error loading .env file:', error);
    process.exit(1);
}
console.log('Environment variables:');
console.log('- OBSIDIAN_VAULT_PATH:', process.env.OBSIDIAN_VAULT_PATH);
console.log('- PORT:', process.env.PORT);
console.log('Current working directory:', process.cwd());
console.log('Environment file:', path.resolve(process.cwd(), '.env'));
const app = express();
const corsOptions = {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/tools", toolRouter);
app.use("/api/ai", aiRouter);
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
            }
            catch (error) {
                vaultExists = false;
            }
        }
        res.json({
            vaultPath,
            vaultExists
        });
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map
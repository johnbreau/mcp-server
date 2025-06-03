import { VectorStore } from './vector-store.js';
import path from 'node:path';
import fs from 'fs-extra';
import { getVaultPath } from './obsidian.js';
let transformers;
async function getTransformers() {
    if (!transformers) {
        transformers = await import('@xenova/transformers');
    }
    return transformers;
}
class EmbeddingService {
    constructor() {
        this.isInitialized = false;
        this.modelName = 'Xenova/all-MiniLM-L6-v2';
        this.extractor = (async () => {
            const { pipeline } = await getTransformers();
            return pipeline('feature-extraction', this.modelName, {
                quantized: false,
            });
        })();
        this.vectorStore = new VectorStore();
    }
    static getInstance() {
        if (!EmbeddingService.instance) {
            EmbeddingService.instance = new EmbeddingService();
        }
        return EmbeddingService.instance;
    }
    async initialize(vaultPath) {
        if (this.isInitialized)
            return;
        console.log(`Initializing embedding service with vault path: ${vaultPath}`);
        if (!await fs.pathExists(vaultPath)) {
            throw new Error(`Vault path does not exist: ${vaultPath}`);
        }
        await this.vectorStore.initialize();
        this.isInitialized = true;
        console.log('Embedding service initialized successfully');
    }
    async generateEmbedding(text) {
        try {
            const extractor = await this.extractor;
            const output = await extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        }
        catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }
    async indexNote(notePath, content) {
        if (!content.trim())
            return;
        const embedding = await this.generateEmbedding(content);
        await this.vectorStore.addEmbedding({
            id: notePath,
            text: content.substring(0, 1000),
            embedding,
            metadata: {
                path: notePath,
                indexedAt: new Date().toISOString()
            }
        });
    }
    async searchSimilarNotes(query, limit = 5) {
        const queryEmbedding = await this.generateEmbedding(query);
        const results = await this.vectorStore.similaritySearch(queryEmbedding, limit);
        return results.map(result => ({
            path: result.metadata.path,
            text: result.text,
            score: result.score
        }));
    }
    async indexVault() {
        const vaultPath = getVaultPath();
        const files = await fs.readdir(vaultPath, { recursive: true, withFileTypes: true });
        const markdownFiles = files
            .filter(entry => {
            const fullPath = path.join(entry.path || '', entry.name);
            return (entry.isFile() &&
                entry.name.endsWith('.md') &&
                !fullPath.includes('node_modules') &&
                !entry.name.startsWith('.'));
        })
            .map(entry => path.join(entry.path || '', entry.name));
        let processed = 0;
        for (const file of markdownFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                await this.indexNote(file, content);
                processed++;
            }
            catch (error) {
                console.error(`Error indexing ${file}:`, error);
            }
        }
        return { total: markdownFiles.length, processed };
    }
}
export const embeddingService = EmbeddingService.getInstance();
//# sourceMappingURL=embeddings.js.map
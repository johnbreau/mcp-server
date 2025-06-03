import { VectorStore } from './vector-store.js';
import path from 'node:path';
import fs from 'fs-extra';
import { getVaultPath } from './obsidian.js';

// Import types from @xenova/transformers
type FeatureExtractionPipeline = any; // Simplified type for now

// Dynamic import for @xenova/transformers
let transformers: any;

async function getTransformers() {
  if (!transformers) {
    transformers = await import('@xenova/transformers');
  }
  return transformers;
}

class EmbeddingService {
  private static instance: EmbeddingService;
  private extractor: Promise<FeatureExtractionPipeline>;
  private vectorStore: VectorStore;
  private isInitialized = false;
  private modelName = 'Xenova/all-MiniLM-L6-v2'; // Small but effective model for embeddings
  
  private constructor() {
    // Initialize the feature extraction pipeline using dynamic import
    this.extractor = (async () => {
      const { pipeline } = await getTransformers();
      return pipeline('feature-extraction', this.modelName, {
        quantized: false, // Set to true for smaller model size but slightly worse quality
      });
    })();
    
    // Initialize the vector store
    this.vectorStore = new VectorStore();
  }

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  async initialize(vaultPath: string): Promise<void> {
    if (this.isInitialized) return;
    
    console.log(`Initializing embedding service with vault path: ${vaultPath}`);
    
    // Verify the vault path exists
    if (!await fs.pathExists(vaultPath)) {
      throw new Error(`Vault path does not exist: ${vaultPath}`);
    }
    
    // Load or create the vector store
    await this.vectorStore.initialize();
    this.isInitialized = true;
    console.log('Embedding service initialized successfully');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const extractor = await this.extractor;
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      // Convert tensor to array and flatten it
      return Array.from(output.data);
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async indexNote(notePath: string, content: string): Promise<void> {
    if (!content.trim()) return;
    
    // Generate embedding for the note content
    const embedding = await this.generateEmbedding(content);
    
    // Store the embedding with its metadata
    await this.vectorStore.addEmbedding({
      id: notePath,
      text: content.substring(0, 1000), // Store first 1000 chars for display
      embedding,
      metadata: {
        path: notePath,
        indexedAt: new Date().toISOString()
      }
    });
  }

  async searchSimilarNotes(query: string, limit: number = 5): Promise<Array<{
    path: string;
    text: string;
    score: number;
  }>> {
    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Find similar notes
    const results = await this.vectorStore.similaritySearch(queryEmbedding, limit);
    
    return results.map(result => ({
      path: result.metadata.path,
      text: result.text,
      score: result.score
    }));
  }

  async indexVault(): Promise<{ total: number; processed: number }> {
    const vaultPath = getVaultPath();
    const files = await fs.readdir(vaultPath, { recursive: true, withFileTypes: true });
    const markdownFiles = files
      .filter(entry => {
        const fullPath = path.join(entry.path || '', entry.name);
        return (
          entry.isFile() && 
          entry.name.endsWith('.md') && 
          !fullPath.includes('node_modules') && 
          !entry.name.startsWith('.')
        );
      })
      .map(entry => path.join(entry.path || '', entry.name));

    let processed = 0;
    for (const file of markdownFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        await this.indexNote(file, content);
        processed++;
      } catch (error) {
        console.error(`Error indexing ${file}:`, error);
      }
    }

    return { total: markdownFiles.length, processed };
  }
}

export const embeddingService = EmbeddingService.getInstance();

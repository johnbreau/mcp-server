import path from 'node:path';
import fsExtra from 'fs-extra';

type VectorDocument = {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
};

type SearchResult = {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, any>;
};

export class VectorStore {
  private documents: VectorDocument[] = [];
  private storagePath: string;
  private isInitialized = false;

  constructor() {
    this.storagePath = path.join(process.cwd(), '.vector-store');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Create storage directory if it doesn't exist
    await fsExtra.ensureDir(this.storagePath);
    
    // Try to load existing vectors
    await this.loadVectors();
    
    this.isInitialized = true;
  }

  private async loadVectors(): Promise<void> {
    const indexPath = path.join(this.storagePath, 'index.json');
    
    try {
      if (await fsExtra.pathExists(indexPath)) {
        const data = await fsExtra.readJson(indexPath);
        this.documents = data.documents || [];
        console.log(`Loaded ${this.documents.length} vectors from storage`);
      } else {
        console.log('No existing vector store found. Starting fresh.');
      }
    } catch (error) {
      console.error('Error loading vector store:', error);
      // If there's an error, start with an empty store
      this.documents = [];
    }
  }

  private async saveVectors(): Promise<void> {
    const indexPath = path.join(this.storagePath, 'index.json');
    
    try {
      await fsExtra.writeJson(indexPath, { documents: this.documents }, { spaces: 2 });
    } catch (error) {
      console.error('Error saving vector store:', error);
      throw error;
    }
  }

  async addEmbedding(doc: Omit<VectorDocument, 'id'> & { id?: string }): Promise<void> {
    const docId = doc.id || Date.now().toString();
    
    // Check if document already exists and update it
    const existingIndex = this.documents.findIndex(d => d.id === docId);
    
    const document: VectorDocument = {
      id: docId,
      text: doc.text,
      embedding: doc.embedding,
      metadata: {
        ...doc.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    if (existingIndex >= 0) {
      this.documents[existingIndex] = document;
    } else {
      this.documents.push(document);
    }

    await this.saveVectors();
  }

  async similaritySearch(queryEmbedding: number[], k: number = 5): Promise<SearchResult[]> {
    if (this.documents.length === 0) return [];

    // Calculate cosine similarity for each document
    const results = this.documents.map(doc => {
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      return {
        id: doc.id,
        text: doc.text,
        score,
        metadata: doc.metadata,
      };
    });

    // Sort by score (descending) and return top k
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  async clear(): Promise<void> {
    this.documents = [];
    await this.saveVectors();
  }
}

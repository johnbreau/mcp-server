import path from 'node:path';
import fsExtra from 'fs-extra';
export class VectorStore {
    constructor() {
        this.documents = [];
        this.isInitialized = false;
        this.storagePath = path.join(process.cwd(), '.vector-store');
    }
    async initialize() {
        if (this.isInitialized)
            return;
        await fsExtra.ensureDir(this.storagePath);
        await this.loadVectors();
        this.isInitialized = true;
    }
    async loadVectors() {
        const indexPath = path.join(this.storagePath, 'index.json');
        try {
            if (await fsExtra.pathExists(indexPath)) {
                const data = await fsExtra.readJson(indexPath);
                this.documents = data.documents || [];
                console.log(`Loaded ${this.documents.length} vectors from storage`);
            }
            else {
                console.log('No existing vector store found. Starting fresh.');
            }
        }
        catch (error) {
            console.error('Error loading vector store:', error);
            this.documents = [];
        }
    }
    async saveVectors() {
        const indexPath = path.join(this.storagePath, 'index.json');
        try {
            await fsExtra.writeJson(indexPath, { documents: this.documents }, { spaces: 2 });
        }
        catch (error) {
            console.error('Error saving vector store:', error);
            throw error;
        }
    }
    async addEmbedding(doc) {
        const docId = doc.id || Date.now().toString();
        const existingIndex = this.documents.findIndex(d => d.id === docId);
        const document = {
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
        }
        else {
            this.documents.push(document);
        }
        await this.saveVectors();
    }
    async similaritySearch(queryEmbedding, k = 5) {
        if (this.documents.length === 0)
            return [];
        const results = this.documents.map(doc => {
            const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
            return {
                id: doc.id,
                text: doc.text,
                score,
                metadata: doc.metadata,
            };
        });
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, k);
    }
    cosineSimilarity(vecA, vecB) {
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
    async clear() {
        this.documents = [];
        await this.saveVectors();
    }
}
//# sourceMappingURL=vector-store.js.map
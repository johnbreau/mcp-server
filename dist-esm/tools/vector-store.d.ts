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
export declare class VectorStore {
    private documents;
    private storagePath;
    private isInitialized;
    constructor();
    initialize(): Promise<void>;
    private loadVectors;
    private saveVectors;
    addEmbedding(doc: Omit<VectorDocument, 'id'> & {
        id?: string;
    }): Promise<void>;
    similaritySearch(queryEmbedding: number[], k?: number): Promise<SearchResult[]>;
    private cosineSimilarity;
    clear(): Promise<void>;
}
export {};

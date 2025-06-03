declare class EmbeddingService {
    private static instance;
    private extractor;
    private vectorStore;
    private isInitialized;
    private modelName;
    private constructor();
    static getInstance(): EmbeddingService;
    initialize(vaultPath: string): Promise<void>;
    generateEmbedding(text: string): Promise<number[]>;
    indexNote(notePath: string, content: string): Promise<void>;
    searchSimilarNotes(query: string, limit?: number): Promise<Array<{
        path: string;
        text: string;
        score: number;
    }>>;
    indexVault(): Promise<{
        total: number;
        processed: number;
    }>;
}
export declare const embeddingService: EmbeddingService;
export {};

import { SearchResult } from '../types/obsidian.js';
interface SemanticSearchResponse {
    results: SearchResult[];
    reasoning: string;
}
export declare class AIService {
    static semanticSearch(query: string, notes: SearchResult[], limit?: number): Promise<SemanticSearchResponse>;
    static summarizeNote(content: string): Promise<string>;
    static answerQuestion(question: string, context: string): Promise<string>;
}
export {};

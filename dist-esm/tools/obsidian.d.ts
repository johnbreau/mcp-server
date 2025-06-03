import type { MCPTool } from "../types.js";
export interface SearchResult {
    path: string;
    content: string;
    lastModified: string;
    size: number;
}
export interface ListResult {
    path: string;
    files: Array<{
        path: string;
        name: string;
        size: number;
        modified?: string;
    }>;
    total: number;
}
export interface ReadResult {
    path: string;
    title: string;
    content: string;
    size: number;
    created?: string;
    modified?: string;
}
interface WordCountResult {
    total: number;
    matches: Array<{
        path: string;
        count: number;
        title: string;
    }>;
}
export declare function getVaultPath(): string;
declare class ObsidianTool implements MCPTool {
    name: string;
    description: string;
    run(params: Record<string, any>): Promise<any>;
    searchNotes(query: string, limit?: number): Promise<{
        results: SearchResult[];
    }>;
    private parseFrontmatter;
    private processWikilinks;
    readNote(filePath: string): Promise<ReadResult>;
    countWordOccurrences(word: string, options?: {
        caseSensitive?: boolean;
        limit?: number;
    }): Promise<WordCountResult>;
    listNotes(directory?: string, limit?: number): Promise<ListResult>;
    getExcerpt(content: string, searchTerm: string, charsAround?: number): string;
}
declare const obsidianTool: ObsidianTool;
export default obsidianTool;

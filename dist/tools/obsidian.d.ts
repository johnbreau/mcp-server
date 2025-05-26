import { MCPTool } from "../types";
interface SearchResult {
    path: string;
    title: string;
    excerpt: string;
    size: number;
    modified: Date;
}
interface ListResult {
    path: string;
    files: Array<{
        path: string;
        name: string;
        size: number;
        modified?: Date;
    }>;
    total: number;
}
interface ReadResult {
    path: string;
    title: string;
    content: string;
    size: number;
    created?: Date;
    modified?: Date;
}
declare class ObsidianTool implements MCPTool {
    name: string;
    description: string;
    run(params: Record<string, any>): Promise<any>;
    searchNotes(query: string, limit: number): Promise<{
        results: SearchResult[];
    }>;
    readNote(filePath: string): Promise<ReadResult>;
    listNotes(directory: string, limit: number): Promise<ListResult>;
    getExcerpt(content: string, searchTerm: string, charsAround?: number): string;
}
declare const obsidianTool: ObsidianTool;
export default obsidianTool;

export interface MCPTool {
  name: string;
  description?: string;
  run: (params: Record<string, any>) => Promise<any>;
  // Optional methods for Obsidian tool
  searchNotes?: (query: string, limit: number) => Promise<any>;
  readNote?: (path: string) => Promise<any>;
  listNotes?: (path: string, limit: number) => Promise<any>;
  getExcerpt?: (content: string, searchTerm: string, charsAround?: number) => string;
}
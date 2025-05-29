declare module 'api/obsidian' {
  export interface SearchResult {
    path: string;
    content: string;
    lastModified: string;
    size: number;
  }

  export interface NoteInfo {
    path: string;
    name: string;
    size: number;
    modified?: string;
  }

  export interface NoteContent {
    path: string;
    title: string;
    content: string;
    size: number;
    created?: string;
    modified?: string;
  }

  export interface ApiClient {
    searchNotes: (query: string, limit?: number) => Promise<SearchResult[]>;
    listNotes: (directory?: string, limit?: number) => Promise<{
      path: string;
      files: NoteInfo[];
      total: number;
    }>;
    getNote: (filePath: string) => Promise<NoteContent>;
  }

  export const api: ApiClient;
}

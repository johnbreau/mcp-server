export interface SearchResult {
  path: string;
  content: string;
  lastModified: string;
  size: number;
}

export interface NoteInfo {
  path: string;
  name: string;
  lastModified: string;
  size: number;
}

export interface NoteContent {
  content: string;
  title?: string;
  lastModified?: string;
  size?: number;
}

export interface ApiClient {
  searchNotes(query: string, limit?: number): Promise<SearchResult[]>;
  listNotes(directory?: string, limit?: number): Promise<NoteInfo[]>;
  getNote(filePath: string): Promise<NoteContent>;
}

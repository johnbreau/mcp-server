import axios from 'axios';
import { SearchResult, NoteInfo, NoteContent, ApiClient } from '../types/obsidian';

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api: ApiClient = {
  searchNotes: async (query: string, limit: number = 5): Promise<SearchResult[]> => {
    try {
      // First list all notes to get their paths
      let allNotes = await api.listNotes('', 1000);
      
      // Filter notes by query if provided
      if (query) {
        const queryLower = query.toLowerCase();
        allNotes = allNotes.filter(note => 
          note.name.toLowerCase().includes(queryLower) ||
          note.path.toLowerCase().includes(queryLower)
        );
      }
      
      // Apply limit
      const notesToProcess = allNotes.slice(0, Math.min(limit, 10)); // Max 10 notes for performance
      
      // Get the content of each note
      const notePromises = notesToProcess.map(async (note) => {
        try {
          const content = await api.getNote(note.path);
          return {
            path: note.path,
            content: content.content,
            lastModified: note.lastModified || new Date().toISOString(),
            size: note.size || 0
          } as SearchResult;
        } catch (error) {
          console.error(`Error getting note ${note.path}:`, error);
          return null;
        }
      });
      
      const notesWithContent = await Promise.all(notePromises);
      
      // Filter out any failed notes and ensure we have valid SearchResult objects
      return notesWithContent.filter((note): note is SearchResult => 
        note !== null && 
        'path' in note && 
        'content' in note &&
        'lastModified' in note &&
        'size' in note
      );
    } catch (error) {
      console.error('Error in searchNotes:', error);
      throw error;
    }
  },

  listNotes: async (directory: string = '', limit: number = 10): Promise<NoteInfo[]> => {
    try {
      const response = await apiClient.post('/tools/obsidian', { 
        action: 'list',
        path: directory, 
        limit 
      });
      return response.data.files || [];
    } catch (error) {
      console.error('Error listing notes:', error);
      throw error;
    }
  },

  getNote: async (filePath: string): Promise<NoteContent> => {
    try {
      const response = await apiClient.post('/tools/obsidian', { 
        action: 'read',
        path: filePath 
      });
      return { content: response.data.content || '' };
    } catch (error) {
      console.error('Error getting note:', error);
      throw error;
    }
  },
};

export type { SearchResult, NoteInfo, NoteContent };

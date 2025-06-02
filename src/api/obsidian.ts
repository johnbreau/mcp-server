import axios from 'axios';
import path from 'path';
import { SearchResult, NoteInfo, NoteContent, ApiClient } from '../types/obsidian';

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000, // 10 second timeout
});

export const api: ApiClient = {
  searchNotes: async (query: string, limit: number = 5): Promise<SearchResult[]> => {
    try {
      if (!query) {
        return [];
      }
      
      console.log(`Searching for: "${query}"`);
      
      // First list all notes to get their paths
      const allNotes = await api.listNotes('', 100); // Limit to 100 notes for performance
      console.log(`Found ${allNotes.length} notes to search through`);
      
      if (allNotes.length === 0) {
        console.log('No notes found to search');
        return [];
      }
      
      // Get the content of each note first
      const notesWithContent = [];
      
      for (const note of allNotes.slice(0, 20)) { // Limit to 20 notes for performance
        try {
          const content = await api.getNote(note.path);
          notesWithContent.push({
            path: note.path,
            name: note.name,
            content: content.content,
            lastModified: note.lastModified || new Date().toISOString(),
            size: note.size || 0
          });
        } catch (error) {
          console.error(`Error getting note ${note.path}:`, error);
        }
      }
      
      console.log(`Successfully retrieved content for ${notesWithContent.length} notes`);
      
      if (notesWithContent.length === 0) {
        return [];
      }
      
      // Filter notes by content
      const queryLower = query.toLowerCase();
      const matchingNotes = notesWithContent.filter(note => 
        note.name.toLowerCase().includes(queryLower) ||
        note.path.toLowerCase().includes(queryLower) ||
        note.content.toLowerCase().includes(queryLower)
      );
      
      console.log(`Found ${matchingNotes.length} matching notes`);
      
      // If we have matches, return them, otherwise return the most recent notes
      const results = matchingNotes.length > 0 
        ? matchingNotes 
        : notesWithContent.slice(0, Math.min(limit, 5)); // Fallback to most recent
      
      return results.slice(0, limit);
    } catch (error) {
      console.error('Error in searchNotes:', error);
      throw error;
    }
  },

  listNotes: async (directory: string = '', limit: number = 10): Promise<NoteInfo[]> => {
    try {
      console.log('Fetching notes from directory:', directory, 'with limit:', limit);
      const response = await apiClient.post('/tools/obsidian', { 
        action: 'list',
        path: directory, 
        limit 
      });
      
      console.log('List notes response:', response.data);
      
      // Handle both response structures for backward compatibility
      const files = response.data.files || [];
      
      return files.map((file: { 
        path: string; 
        name?: string; 
        modified?: string; 
        size?: number 
      }) => ({
        path: file.path,
        name: file.name || path.basename(file.path, '.md'),
        lastModified: file.modified || new Date().toISOString(),
        size: file.size || 0
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Error listing notes:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
      } else if (error instanceof Error) {
        console.error('Error listing notes:', error.message);
      } else {
        console.error('Unknown error listing notes');
      }
      throw error;
    }
  },

  getNote: async (filePath: string): Promise<NoteContent> => {
    try {
      console.log('Fetching note:', filePath);
      const response = await apiClient.post('/tools/obsidian', { 
        action: 'read',
        path: filePath 
      });
      
      console.log('Get note response:', { 
        path: filePath,
        contentLength: response.data.content?.length || 0 
      });
      
      return { 
        content: response.data.content || '',
        ...(response.data.title && { title: response.data.title }),
        ...(response.data.modified && { lastModified: response.data.modified }),
        ...(response.data.size && { size: response.data.size })
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Error getting note:', {
          path: filePath,
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
      } else if (error instanceof Error) {
        console.error(`Error getting note ${filePath}:`, error.message);
      } else {
        console.error('Unknown error getting note:', filePath);
      }
      throw error;
    }
  },
};

export type { SearchResult, NoteInfo, NoteContent };

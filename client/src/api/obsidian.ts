import axios, { AxiosError } from 'axios';
import path from 'path';

// Type definitions
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
}

export interface SemanticSearchResult {
  results: SearchResult[];
  reasoning: string;
  total: number;
}

export interface SummarizeResult {
  summary: string;
}

export interface AnswerResult {
  answer: string;
  sources?: string[];
}

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // Required for CORS with credentials
  timeout: 10000, // 10 second timeout
});

// Add request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log('Request:', {
        url: config.url,
        method: config.method,
        data: config.data,
      });
    }
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
apiClient.interceptors.response.use(
  (response) => {
    console.log('Response:', {
      url: response.config.url,
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error: AxiosError) => {
    console.error('Response Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config,
    });
    return Promise.reject(error);
  }
);



export const api = {
  searchNotes: async (query: string, limit: number = 5): Promise<SearchResult[]> => {
    try {
      console.log('Sending search request with query:', { query, limit });
      const response = await apiClient.get('/api/tools/obsidian', {
        params: {
          action: 'search',
          query,
          limit
        }
      });
      
      console.log('Search response:', response.data);
      
      if (!response.data || !Array.isArray(response.data.results)) {
        console.error('Unexpected response format:', response.data);
        throw new Error('Invalid response format from server');
      }
      
      return response.data.results.map((result: { path: string; content?: string; lastModified?: string; size?: number }) => ({
        path: result.path,
        content: result.content || '',
        lastModified: result.lastModified || new Date().toISOString(),
        size: result.size || 0
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Axios error in searchNotes:', {
          message: error.message,
          code: error.code,
          config: error.config,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          } : 'No response'
        });

        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Error response data:', error.response.data);
          console.error('Error status:', error.response.status);
          console.error('Error headers:', error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          console.error('No response received:', error.request);
        }
      } else if (error instanceof Error) {
        // Something happened in setting up the request that triggered an Error
        console.error('Error in searchNotes:', error.message);
      } else {
        console.error('Unknown error occurred in searchNotes');
      }
      
      throw error;
    }
  },

  listNotes: async (directory: string = '', limit: number = 10): Promise<NoteInfo[]> => {
    try {
      console.log('Fetching notes from directory:', directory, 'with limit:', limit);
      const response = await apiClient.post('/api/tools/obsidian', {
        action: 'list',
        path: directory,
        limit
      });
      
      console.log('List notes response:', response.data);
      
      // Handle both response structures for backward compatibility
      const files = response.data.files || response.data.data?.files || [];
      
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
      const response = await apiClient.get('/api/tools/obsidian', {
        params: {
          action: 'read',
          path: filePath
        }
      });
      return { content: response.data.content || '' };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Error in getNote:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
      } else if (error instanceof Error) {
        console.error('Error in getNote:', error.message);
      } else {
        console.error('Unknown error in getNote');
      }
      throw error;
    }
  },

  // AI Service Methods
  semanticSearch: async (query: string, limit: number = 5): Promise<SemanticSearchResult> => {
    try {
      const response = await apiClient.post('/api/ai/semantic-search', {
        query,
        limit,
      });
      return response.data;
    } catch (error) {
      console.error('Error performing semantic search:', error);
      throw error;
    }
  },

  summarizeNote: async (content: string): Promise<SummarizeResult> => {
    try {
      const response = await apiClient.post('/api/ai/summarize', { content });
      return response.data;
    } catch (error) {
      console.error('Error summarizing note:', error);
      throw error;
    }
  },

  askQuestion: async (question: string, notePath?: string): Promise<AnswerResult> => {
    try {
      const response = await apiClient.post('/api/ai/ask', {
        question,
        notePath: notePath || undefined,
      });
      return response.data;
    } catch (error) {
      console.error('Error asking question:', error);
      throw error;
    }
  },
};

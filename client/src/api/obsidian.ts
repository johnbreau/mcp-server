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
  success: boolean;
  data: {
    results: SearchResult[];
    reasoning: string;
    total: number;
  };
}

export interface SummarizeResult {
  success: boolean;
  message?: string;
  summary: string;
  error?: string;
}

export interface AnswerResult {
  success: boolean;
  message?: string;
  data: {
    answer: string;
    context?: string;
    sources?: string[];
  };
}

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api', // Use relative URL for Vite proxy
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 30000, // 30 seconds timeout for regular requests
});

// Create a separate instance for AI requests with a longer timeout
const aiApiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 120000, // 2 minutes timeout for AI requests
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
      
      // Use the search action in the backend
      const response = await apiClient.post('/tools/obsidian', {
        action: 'search',
        query,
        limit
      });
      
      console.log('Search response:', response.data);
      
      // Handle the response from the backend search
      if (!response.data || !Array.isArray(response.data.results)) {
        console.error('Unexpected response format:', response.data);
        throw new Error('Invalid response format from server');
      }
      
      // Define the search result type from the API response
      interface SearchResultFromApi {
        path: string;
        content?: string;
        lastModified?: string;
        size?: number;
      }

      // Map the response to the expected format
      return response.data.results.map((result: SearchResultFromApi) => ({
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
      const response = await apiClient.post('/tools/obsidian', {
        action: 'list',
        directory: directory || undefined,
        limit
      });
      
      if (!response.data || !Array.isArray(response.data.files)) {
        console.error('Unexpected response format:', response.data);
        throw new Error('Invalid response format from server');
      }
      
      return response.data.files.map((file: { path: string; name?: string; modified?: string; size?: number }) => ({
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
      console.log('Sending semantic search request with query:', { query, limit });
      const response = await aiApiClient.post('/ai/semantic-search', { query, limit });
      
      // Ensure the response has the expected structure
      if (!response.data || !response.data.data) {
        console.error('Invalid response format from semantic search:', response.data);
        throw new Error('Invalid response format from semantic search');
      }
      
      console.log('Semantic search response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error performing semantic search:', error);
      // Return a properly structured error response
      return {
        success: false,
        data: {
          results: [],
          reasoning: error instanceof Error ? error.message : 'An error occurred while performing the search.',
          total: 0
        }
      };
    }
  },

  summarizeNote: async (content: string): Promise<SummarizeResult> => {
    try {
      console.log('Sending content for summarization, length:', content.length);
      const response = await aiApiClient.post('/ai/summarize', { 
        content: content.slice(0, 10000) // Limit content length to prevent timeouts
      });
      
      if (!response.data || typeof response.data.summary !== 'string') {
        throw new Error('Invalid response format from summarization service');
      }
      
      return {
        success: true,
        summary: response.data.summary
      };
    } catch (error) {
      console.error('Error summarizing note:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        summary: 'Failed to generate summary. The content might be too long or the service is unavailable.',
        error: errorMessage
      };
    }
  },

  askQuestion: async (question: string, notePath?: string): Promise<AnswerResult> => {
    try {
      console.log('Sending question to AI:', { question, notePath });
      const response = await aiApiClient.post('/ai/ask', {
        question,
        notePath: notePath || undefined,
      });
      
      console.log('AI response:', response.data);
      
      // Ensure the response has the expected structure
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid response format from AI service');
      }
      
      return response.data;
    } catch (error) {
      console.error('Error asking question:', error);
      
      // Return a properly structured error response
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        data: {
          answer: 'Sorry, I encountered an error while processing your question. Please try again later.',
          context: '',
          sources: []
        }
      };
    }
  },
};

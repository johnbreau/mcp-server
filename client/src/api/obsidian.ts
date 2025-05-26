import axios, { AxiosError } from 'axios';

// Create an axios instance with default config
const apiClient = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log('Request:', {
      url: config.url,
      method: config.method,
      data: config.data,
    });
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

export const api = {
  searchNotes: async (query: string, limit: number = 5): Promise<SearchResult[]> => {
    try {
      const response = await apiClient.post('/tools/obsidian', { 
        action: 'search',
        query,
        limit 
      });
      return response.data.results || [];
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
      console.error('Error in listNotes:', error);
      throw error;
    }
  },

  getNote: async (filePath: string): Promise<{ content: string }> => {
    try {
      const response = await apiClient.post('/tools/obsidian', { 
        action: 'read',
        path: filePath 
      });
      return { content: response.data.content || '' };
    } catch (error) {
      console.error('Error in getNote:', error);
      throw error;
    }
  },
};

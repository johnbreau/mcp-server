import axios from 'axios';

const API_BASE_URL = '/api';

export interface JournalEntry {
  id: string;
  title: string;
  description: string;
  date: string;
  metadata: {
    path: string;
    wordCount: number;
  };
}

export const journalApi = {
  async getRandomEntry(): Promise<JournalEntry> {
    const response = await axios.get(`${API_BASE_URL}/journal/random`);
    return response.data;
  },
  
  async getEntry(id: string): Promise<JournalEntry> {
    const response = await axios.get(`${API_BASE_URL}/journal/entries/${id}`);
    return response.data;
  },
  
  async getAllEntries(): Promise<JournalEntry[]> {
    const response = await axios.get(`${API_BASE_URL}/journal/entries`);
    return response.data;
  },
  
  async searchEntries(query: string): Promise<JournalEntry[]> {
    const response = await axios.get(`${API_BASE_URL}/journal/search`, {
      params: { q: query }
    });
    return response.data;
  }
};

export default journalApi;

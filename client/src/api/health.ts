import axios from 'axios';
import type { AppleHealthDataPoint } from '../features/health/utils/transformData';

// Base URL for the Apple Health Data Server
const HEALTH_API_BASE_URL = 'http://localhost:8000';

// Type definitions
export interface HealthDataItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  content?: unknown;
}

export interface SleepData {
  date: string;
  inBed: number;
  asleep: number;
  deep: number;
  rem: number;
  light: number;
  awake: number;
}

interface ApiResponse<T> {
  contents: T[];
}

// Create axios instance
const healthApi = axios.create({
  baseURL: HEALTH_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper function to handle errors
const handleError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    console.error('API Error:', error.message);
    throw new Error(error.response?.data?.detail || 'Failed to fetch health data');
  }
  throw new Error('An unexpected error occurred');
};

export const healthApiClient = {
  // List all files and directories in the appleHealthData directory
  async listFiles(path = ''): Promise<HealthDataItem[]> {
    try {
      const response = await healthApi.get<ApiResponse<HealthDataItem>>(
        path ? `/file/${path}`.replace(/\/+/g, '/') : '/'
      );
      return response.data.contents;
    } catch (error) {
      return handleError(error);
    }
  },

  // Get file content
  async getFileContent(path: string): Promise<HealthDataItem> {
    try {
      const response = await healthApi.get<HealthDataItem>(`/file/${path}`.replace(/\/+/g, '/'));
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  // Get clinical records
  async getClinicalRecords(type?: string): Promise<HealthDataItem[]> {
    try {
      const path = type ? `clinical-records/${type}` : 'clinical-records';
      const response = await healthApi.get<ApiResponse<HealthDataItem>>(
        `/file/${path}`.replace(/\/+/g, '/')
      );
      return response.data.contents;
    } catch (error) {
      return handleError(error);
    }
  },

  // Get specific clinical record content
  async getClinicalRecord(path: string): Promise<HealthDataItem> {
    try {
      const response = await healthApi.get<HealthDataItem>(
        `/file/clinical-records/${path}`.replace(/\/+/g, '/')
      );
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  // Get activity data (steps, calories, distance)
  async getActivityData(limit = 30): Promise<AppleHealthDataPoint[]> {
    try {
      const response = await healthApi.get<AppleHealthDataPoint[]>(`/api/activity?days=${limit}`);
      return response.data.map(item => ({
        ...item,
        date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
        calories: item.activeEnergyBurned || 0,
        type: 'activity'
      }));
    } catch (error) {
      console.error('Error fetching activity data:', error);
      
      // Fallback to mock data if the API call fails
      console.warn('Using mock data due to error');
      const now = new Date();
      const mockData: AppleHealthDataPoint[] = [];
      
      for (let i = limit - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        
        mockData.push({
          date: date.toISOString(),
          steps: Math.floor(3000 + Math.random() * 7000), // 3000-10000 steps
          calories: Math.floor(200 + Math.random() * 800), // 200-1000 calories
          distance: parseFloat((3 + Math.random() * 7).toFixed(2)), // 3-10 km
          type: 'mock',
        });
      }
      
      return mockData;
    }
  },

  // Get heart rate data
  async getHeartRateData(limit = 30): Promise<AppleHealthDataPoint[]> {
    try {
      const response = await healthApi.get<ApiResponse<AppleHealthDataPoint>>('/file/heart-rate');
      return response.data.contents.slice(0, limit);
    } catch (error) {
      return handleError(error);
    }
  },

  // Get sleep data
  async getSleepData(limit = 30): Promise<SleepData[]> {
    try {
      const response = await healthApi.get('/api/health/sleep', {
        params: { days: limit }
      });
      
      // Transform the response to match the expected format
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching sleep data:', error);
      return [];
    }
  },

  // Get nutrition data
  async getNutritionData(limit = 30): Promise<AppleHealthDataPoint[]> {
    try {
      const response = await healthApi.get<ApiResponse<AppleHealthDataPoint>>('/file/nutrition');
      return response.data.contents.slice(0, limit);
    } catch (error) {
      return handleError(error);
    }
  },

  // Get steps data
  async getStepsData(limit = 30): Promise<AppleHealthDataPoint[]> {
    try {
      const response = await healthApi.get<ApiResponse<AppleHealthDataPoint>>('/file/steps');
      return response.data.contents.slice(0, limit);
    } catch (error) {
      return handleError(error);
    }
  },
};

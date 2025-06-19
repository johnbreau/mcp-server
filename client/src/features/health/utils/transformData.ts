// Type definitions for Apple Health data
export interface AppleHealthDataPoint {
  date?: string;
  startDate?: string;
  endDate?: string;
  creationDate?: string;
  sourceName?: string;
  sourceVersion?: string;
  value?: number | string;
  unit?: string;
  type?: string;
  
  // Common fields
  steps?: number;
  calories?: number;
  activeEnergyBurned?: number;
  distance?: number;
  heartRate?: number;
  sleepHours?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  count?: number;
  
  // For sleep analysis
  sleepAnalysis?: {
    value: string;
    startDate: string;
    endDate: string;
  }[];
  
  // For workouts
  workoutType?: string;
  duration?: number;
  totalDistance?: number;
  totalEnergyBurned?: number;
  
  // For nutrition
  dietaryEnergy?: number;
  dietaryProtein?: number;
  dietaryCarbohydrates?: number;
  dietaryFatTotal?: number;
}

// Helper function to format date for display
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return new Date().toISOString().split('T')[0];
  }
};

// Helper to get date from various possible fields
const getDate = (item: AppleHealthDataPoint): string => {
  if (item.startDate) return item.startDate;
  if (item.date) return item.date;
  if (item.creationDate) return item.creationDate;
  if (item.sleepAnalysis?.[0]?.startDate) return item.sleepAnalysis[0].startDate;
  return new Date().toISOString();
};

// Helper to safely convert value to number
const toNumber = (value: string | number | undefined): number => {
  if (value === undefined) return 0;
  if (typeof value === 'number') return value;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

// Type for activity data
export interface ActivityDataPoint {
  date: string;
  steps: number;
  calories: number;
  distance: number;
}

// Transform Apple Health data for Activity Chart
export const transformActivityData = (data: AppleHealthDataPoint[]): ActivityDataPoint[] => {
  if (!Array.isArray(data)) {
    console.error('Expected array of data points, got:', data);
    return [];
  }

  // Group by date
  const groupedByDate = data.reduce<Record<string, Partial<ActivityDataPoint>>>((acc, item) => {
    const date = formatDate(getDate(item));
    if (!acc[date]) {
      acc[date] = { date, steps: 0, calories: 0, distance: 0 };
    }
    
    const entry = acc[date];
    if (!entry) return acc;
    
    // Sum up values
    entry.steps = (entry.steps || 0) + toNumber(item.steps || item.count || 0);
    entry.calories = (entry.calories || 0) + toNumber(item.calories || item.activeEnergyBurned || item.totalEnergyBurned || 0);
    
    // Convert distance to km if needed
    const distance = toNumber(item.distance || item.totalDistance || 0);
    entry.distance = (entry.distance || 0) + (item.unit === 'm' ? distance / 1000 : distance);
    
    return acc;
  }, {});

  // Convert to array and sort by date
  return Object.values(groupedByDate)
    .filter((item): item is ActivityDataPoint => !!item.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7); // Get only the last 7 days
};

// Type for heart rate data
export interface HeartRateDataPoint {
  date: string;
  value: number;
  type: string;
}

// Transform Apple Health data for Heart Rate Chart
export const transformHeartRateData = (data: AppleHealthDataPoint[]): HeartRateDataPoint[] => {
  if (!Array.isArray(data)) return [];
  
  return data
    .map(item => ({
      date: formatDate(getDate(item)),
      value: toNumber(item.value || item.heartRate || 0),
      type: item.type || 'resting'
    }))
    .filter((item): item is HeartRateDataPoint => 
      typeof item.value === 'number' && 
      typeof item.type === 'string' &&
      !isNaN(new Date(item.date).getTime())
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-24); // Get last 24 hours
};

// Type for sleep data
export interface SleepDataPoint {
  date: string;
  value: number;
  type: string;
}

// Transform Apple Health data for Sleep Chart
export const transformSleepData = (data: AppleHealthDataPoint[]): SleepDataPoint[] => {
  if (!Array.isArray(data)) return [];
  
  // Process sleep analysis data if available
  const sleepData = data.flatMap(item => {
    if (item.sleepAnalysis?.length) {
      return item.sleepAnalysis.map(sleep => ({
        date: formatDate(sleep.startDate),
        value: (new Date(sleep.endDate).getTime() - new Date(sleep.startDate).getTime()) / (1000 * 60 * 60), // hours
        type: sleep.value.toLowerCase()
      }));
    }
    
    // Fallback to regular sleep data
    return {
      date: formatDate(getDate(item)),
      value: toNumber(item.value || item.sleepHours || 0),
      type: (item.type || 'asleep').toLowerCase()
    };
  });
  
  // Group by date and type
  const grouped = sleepData.reduce<Record<string, Record<string, number>>>((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = {};
    }
    acc[item.date][item.type] = (acc[item.date][item.type] || 0) + item.value;
    return acc;
  }, {});
  
  // Convert to array of SleepDataPoint
  return Object.entries(grouped)
    .map(([date, types]) => ({
      date,
      value: Object.values(types).reduce((sum, val) => sum + val, 0),
      type: 'total'
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7); // Get last 7 days
};

// Type for nutrition data
export interface NutritionDataPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Transform Apple Health data for Nutrition Chart
export const transformNutritionData = (data: AppleHealthDataPoint[]): NutritionDataPoint[] => {
  if (!Array.isArray(data)) return [];
  
  // Group by date
  const groupedByDate = data.reduce<Record<string, Partial<NutritionDataPoint>>>((acc, item) => {
    const date = formatDate(getDate(item));
    if (!acc[date]) {
      acc[date] = { date, calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    
    const entry = acc[date];
    if (!entry) return acc;
    
    // Sum up nutritional values
    entry.calories = (entry.calories || 0) + toNumber(item.calories || item.dietaryEnergy || 0);
    entry.protein = (entry.protein || 0) + toNumber(item.protein || item.dietaryProtein || 0);
    entry.carbs = (entry.carbs || 0) + toNumber(item.carbs || item.dietaryCarbohydrates || 0);
    entry.fat = (entry.fat || 0) + toNumber(item.fat || item.dietaryFatTotal || 0);
    
    return acc;
  }, {});
  
  // Convert to array and sort by date
  return Object.values(groupedByDate)
    .filter((item): item is NutritionDataPoint => !!item.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7); // Get only the last 7 days
};

// Type for steps data
export interface StepsDataPoint {
  date: string;
  steps: number;
  distance: number;
}

// Transform Apple Health data for Steps Chart
export const transformStepsData = (data: AppleHealthDataPoint[]): StepsDataPoint[] => {
  if (!Array.isArray(data)) return [];
  
  // Group by date
  const groupedByDate = data.reduce<Record<string, Partial<StepsDataPoint>>>((acc, item) => {
    const date = formatDate(getDate(item));
    if (!acc[date]) {
      acc[date] = { date, steps: 0, distance: 0 };
    }
    
    const entry = acc[date];
    if (!entry) return acc;
    
    // Sum up steps and distance
    entry.steps = (entry.steps || 0) + toNumber(item.steps || item.count || 0);
    
    // Convert distance to km if needed
    const distance = toNumber(item.distance || item.totalDistance || 0);
    entry.distance = (entry.distance || 0) + (item.unit === 'm' ? distance / 1000 : distance);
    
    return acc;
  }, {});
  
  // Convert to array and sort by date
  return Object.values(groupedByDate)
    .filter((item): item is StepsDataPoint => !!item.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30); // Get last 30 days
};

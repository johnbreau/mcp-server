import { Paper, Title, Text, useMantineColorScheme, Box, LoadingOverlay } from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState, useEffect, useMemo } from 'react';
import type { SleepData } from '../../../api/health';
import { healthApiClient } from '../../../api/health';

// Helper function to format date for X-axis
const formatXAxis = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface EnhancedSleepData extends SleepData {
  efficiency: number;
}

interface SleepSummary {
  avgInBed: number;
  avgAsleep: number;
  avgEfficiency: number;
  avgDeep: number;
}

export const SleepChart = () => {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [sleepData, setSleepData] = useState<EnhancedSleepData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialSummary = useMemo<SleepSummary>(() => ({
    avgInBed: 0,
    avgAsleep: 0,
    avgEfficiency: 0,
    avgDeep: 0
  }), []);
  
  const [summary, setSummary] = useState<SleepSummary>(initialSummary);

  // Transform API data to match our EnhancedSleepData interface
  const transformApiData = (data: SleepData[]): EnhancedSleepData[] => {
    return data.map(item => ({
      ...item,
      inBed: item.inBed || 0,
      asleep: item.asleep || 0,
      deep: item.deep || 0,
      rem: item.rem || 0,
      light: item.light || 0,
      awake: item.awake || 0,
      efficiency: Math.round(((item.asleep || 0) / (item.inBed || 1)) * 100) || 0
    }));
  };

  // Calculate chart data and summary
  const { chartData, chartSummary } = useMemo(() => {
    if (sleepData.length === 0) {
      return { chartData: [], chartSummary: initialSummary };
    }
    
    const totalDays = sleepData.length;
    const summary = sleepData.reduce((acc, day) => ({
      inBed: acc.inBed + (day.inBed || 0),
      asleep: acc.asleep + (day.asleep || 0),
      deep: acc.deep + (day.deep || 0),
      efficiency: acc.efficiency + ((day.asleep || 0) / (day.inBed || 1)) * 100
    }), { inBed: 0, asleep: 0, deep: 0, efficiency: 0 });

    const newSummary: SleepSummary = {
      avgInBed: summary.inBed / totalDays,
      avgAsleep: summary.asleep / totalDays,
      avgEfficiency: summary.efficiency / totalDays,
      avgDeep: summary.deep / totalDays
    };

    return { 
      chartData: [...sleepData], // Return a new array to ensure referential inequality
      chartSummary: newSummary 
    };
  }, [sleepData, initialSummary]);

  // Update summary state when it changes
  useEffect(() => {
    setSummary(chartSummary);
  }, [chartSummary]);

  // Fetch sleep data on component mount
  useEffect(() => {
    const fetchSleepData = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching sleep data...');
        const data = await healthApiClient.getSleepData(30);
        console.log('Raw API response:', data);
        
        const formattedData = transformApiData(data);
        console.log('Transformed sleep data:', formattedData);
        
        setSleepData(formattedData);
      } catch (err) {
        console.error('Error fetching sleep data:', err);
        setError('Failed to load sleep data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSleepData();
  }, []);

  if (isLoading) {
    return (
      <Paper p="md" withBorder>
        <Title order={3} mb="md">Sleep Analysis</Title>
        <Box style={{ height: 300 }}>
          <LoadingOverlay visible={true} />
        </Box>
      </Paper>
    );
  }


  if (error) {
    return (
      <Paper p="md" withBorder>
        <Title order={3} mb="md">Sleep Analysis</Title>
        <Text color="red">{error}</Text>
      </Paper>
    );
  }

  if (sleepData.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Title order={3} mb="md">Sleep Analysis</Title>
        <Text>No sleep data available</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Title order={3} mb="md">Sleep Analysis</Title>
      
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <Paper p="sm" withBorder>
          <Text size="sm" c="dimmed">Avg. Time in Bed</Text>
          <Text fw={700}>{(summary.avgInBed / 60).toFixed(1)} hrs</Text>
        </Paper>
        <Paper p="sm" withBorder>
          <Text size="sm" c="dimmed">Avg. Sleep</Text>
          <Text fw={700}>{(summary.avgAsleep / 60).toFixed(1)} hrs</Text>
        </Paper>
        <Paper p="sm" withBorder>
          <Text size="sm" c="dimmed">Avg. Sleep Efficiency</Text>
          <Text fw={700}>{summary.avgEfficiency.toFixed(1)}%</Text>
        </Paper>
        <Paper p="sm" withBorder>
          <Text size="sm" c="dimmed">Avg. Deep Sleep</Text>
          <Text fw={700}>{(summary.avgDeep / 60).toFixed(1)} hrs</Text>
        </Paper>
      </div>

      {/* Sleep Duration Chart */}
      <Text size="sm" fw={700} mb="sm">Sleep Duration (Last 30 Days)</Text>
      <div style={{ height: 300, marginBottom: '2rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            barGap={0}
            barCategoryGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={formatXAxis}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(value) => `${Math.round(Number(value) / 60)}h`}
            />
            <Tooltip 
              formatter={(value: unknown, name: string) => {
                const numValue = Number(value);
                const hours = Math.floor(numValue / 60);
                const minutes = Math.round(numValue % 60);
                return [`${hours}h ${minutes > 0 ? `${minutes}m` : ''}`, name];
              }}
              labelFormatter={(label: string) => `Date: ${new Date(label).toLocaleDateString()}`}
            />
            <Legend />
            <Bar 
              dataKey="asleep" 
              name="Asleep" 
              fill={isDark ? '#4dabf7' : '#228be6'} 
              radius={[4, 4, 0, 0]}
              stackId="a"
            />
            <Bar 
              dataKey="awake" 
              name="Awake" 
              fill={isDark ? '#495057' : '#ced4da'} 
              radius={[0, 0, 4, 4]}
              stackId="a"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sleep Stages Chart */}
      <Text size="sm" fw={700} mb="sm">Sleep Stages (Last 30 Days)</Text>
      <div style={{ height: 300, marginBottom: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            barGap={0}
            barCategoryGap={2}
            stackOffset="expand"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={formatXAxis}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
              domain={[0, 1]}
            />
            <Tooltip 
              formatter={(value: unknown, name: string) => {
                const percentage = Math.round(Number(value) * 100);
                return [`${percentage}%`, name];
              }}
              labelFormatter={(label: string) => `Date: ${new Date(label).toLocaleDateString()}`}
            />
            <Legend />
            <Bar 
              dataKey={(data: EnhancedSleepData) => data.deep / (data.inBed || 1)} 
              name="Deep" 
              fill={isDark ? '#1864ab' : '#1c7ed6'} 
              stackId="a"
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey={(data: EnhancedSleepData) => data.rem / (data.inBed || 1)} 
              name="REM" 
              fill={isDark ? '#5c940d' : '#82c91e'} 
              stackId="a"
            />
            <Bar 
              dataKey={(data: EnhancedSleepData) => data.light / (data.inBed || 1)} 
              name="Light" 
              fill={isDark ? '#fcc419' : '#ffd43b'} 
              stackId="a"
            />
            <Bar 
              dataKey={(data: EnhancedSleepData) => (data.awake || 0) / (data.inBed || 1)} 
              name="Awake" 
              fill={isDark ? '#495057' : '#ced4da'} 
              stackId="a"
              radius={[0, 0, 4, 4]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Paper>
  );
};

export default SleepChart;

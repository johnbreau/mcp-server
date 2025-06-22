import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, type TooltipProps } from 'recharts';
import { Paper, Title, Loader, Alert, Box, Button, Group, useMantineTheme, Text } from '@mantine/core';
import { useColorScheme } from '@mantine/hooks';
// API client import removed since we're using mock data

// Mock date utils if they don't exist
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

type TimeRange = 'day' | 'week' | 'month';

// AppleHealthDataPoint type is not currently used in the component
// but kept for future reference
// interface AppleHealthDataPoint {
//   time: string;
//   bpm: number;
//   type: string;
// }

interface DayDataPoint {
  time: string;
  bpm: number;
  type: string;
}

interface WeekDataPoint {
  day: string;
  bpm: number;
  type: string;
}

interface MonthDataPoint {
  week: string;
  avg: number;
  min: number;
  max: number;
}

type ChartDataPoint = DayDataPoint | WeekDataPoint | MonthDataPoint;

interface BaseDataPoint {
  type: string;
}

interface DayDataPoint extends BaseDataPoint {
  time: string;
  bpm: number;
}

interface WeekDataPoint extends BaseDataPoint {
  day: string;
  bpm: number;
}

interface MonthDataPoint extends BaseDataPoint {
  week: string;
  avg: number;
  min: number;
  max: number;
}

// Type guard functions (commented out since they're not currently used)
// const isDayData = (point: ChartDataPoint): point is DayDataPoint => {
//   return 'time' in point && 'bpm' in point && 'type' in point;
// };

// const isWeekData = (point: ChartDataPoint): point is WeekDataPoint => {
//   return 'day' in point && 'bpm' in point && 'type' in point;
// };

export const HeartRateChart: React.FC = () => {
  const theme = useMantineTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [timeRange, setTimeRange] = useState<TimeRange>('day');
  const [isLoading, setIsLoading] = useState(true);
  // Error state for handling API errors
  // Note: Error state is preserved in the component for future error handling
  const [, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<DayDataPoint[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  
  const now = useMemo(() => new Date(), []);

  // Theme-aware colors
  const gridColor = useMemo(() => {
    const [lightKey, lightValue] = 'gray.2'.split('.');
    const [darkKey, darkValue] = 'dark.5'.split('.');
    return isDark 
      ? theme.colors[darkKey][parseInt(darkValue, 10)]
      : theme.colors[lightKey][parseInt(lightValue, 10)];
  }, [isDark, theme.colors]);

  const tickColor = useMemo(() => {
    const [lightKey, lightValue] = 'gray.7'.split('.');
    const [darkKey, darkValue] = 'gray.4'.split('.');
    return isDark 
      ? theme.colors[darkKey][parseInt(darkValue, 10)]
      : theme.colors[lightKey][parseInt(lightValue, 10)];
  }, [isDark, theme.colors]);

  const tooltipBg = useMemo(() => isDark ? theme.colors.dark[7] : theme.white, [isDark, theme.colors, theme.white]);
  const tooltipBorder = useMemo(() => isDark ? theme.colors.dark[3] : theme.colors.gray[3], [isDark, theme.colors]);

  // Process and format chart data 
  useEffect(() => {
    if (!rawData.length) return;
    
    try {
      let processedData: ChartDataPoint[] = [];
      
      if (timeRange === 'day') {
        processedData = rawData
          .filter((item): item is DayDataPoint => 'time' in item)
          .filter(item => new Date(item.time) >= new Date(now.getTime() - 24 * 60 * 60 * 1000))
          .map(item => ({
            time: formatTime(new Date(item.time)),
            bpm: item.bpm,
            type: item.type
          }));
      } else if (timeRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const grouped = rawData
          .filter((item): item is DayDataPoint => 'time' in item)
          .filter(item => new Date(item.time) >= weekAgo)
          .reduce<Record<string, { sum: number; count: number; type: string }>>((acc, item) => {
            const date = new Date(item.time);
            const dayKey = date.toISOString().split('T')[0];
            if (!acc[dayKey]) {
              acc[dayKey] = { sum: 0, count: 0, type: item.type };
            }
            acc[dayKey].sum += item.bpm;
            acc[dayKey].count++;
            return acc;
          }, {});
        
        processedData = Object.entries(grouped).map(([day, { sum, count, type }]) => ({
          day: new Date(day).toLocaleDateString([], { weekday: 'short' }),
          bpm: Math.round(sum / count),
          type
        }));
      } else {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const grouped = rawData
          .filter((item): item is DayDataPoint => 'time' in item)
          .filter(item => new Date(item.time) >= monthAgo)
          .reduce<Record<number, { sum: number; count: number; min: number; max: number }>>((acc, item) => {
            const date = new Date(item.time);
            const weekNum = getWeekNumber(date);
            if (!acc[weekNum]) {
              acc[weekNum] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
            }
            acc[weekNum].sum += item.bpm;
            acc[weekNum].count++;
            acc[weekNum].min = Math.min(acc[weekNum].min, item.bpm);
            acc[weekNum].max = Math.max(acc[weekNum].max, item.bpm);
            return acc;
          }, {});
        
        processedData = Object.entries(grouped).map(([week, { sum, count, min, max }]) => ({
          week: `Week ${week}`,
          avg: Math.round(sum / count),
          min,
          max,
          type: 'average'
        }));
      }
      
      setChartData(processedData);
    } catch (err) {
      console.error('Error processing chart data:', err);
      setError('Failed to process chart data');
    }
  }, [rawData, timeRange, now]);

  // Fetch data from API when timeRange changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        let limit = 100; // Default limit
        
        // Adjust limit based on time range
        if (timeRange === 'day') {
          limit = 144; // 24 hours * 6 (10-minute intervals)
        } else if (timeRange === 'week') {
          limit = 7; // 7 days
        } else if (timeRange === 'month') {
          limit = 4; // 4 weeks
        }
        
        // Mock data since we don't have the actual API implementation
        const mockData: DayDataPoint[] = Array.from({ length: limit }, (_, i) => {
          const date = new Date();
          date.setHours(date.getHours() - i);
          return {
            time: date.toISOString(),
            bpm: Math.floor(Math.random() * 40) + 60, // Random heart rate between 60-100
            type: 'mock'
          };
        });
        setRawData(mockData);
        setError(null); // Clear any previous errors
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch heart rate data';
        setError(errorMessage);
        console.error('Error fetching heart rate data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [timeRange]);

  // Memoized x-axis key based on time range
  const xAxisKey = useMemo(() => {
    switch (timeRange) {
      case 'day': return 'time';
      case 'week': return 'day';
      case 'month': return 'week';
      default: return 'time';
    }
  }, [timeRange]);

  // Get y-axis label text based on time range
  const getYAxisLabel = useCallback(() => 'BPM', []);

  // Custom tooltip component
  const CustomTooltip = useCallback(({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
      <div style={{
        backgroundColor: tooltipBg,
        border: `1px solid ${tooltipBorder}`,
        padding: '10px',
        borderRadius: '4px',
        color: isDark ? theme.white : theme.black,
      }}>
        <p style={{ margin: 0, fontWeight: 500 }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ margin: '5px 0 0 0', color: entry.color }}>
            {`${entry.name}: ${entry.value} bpm`}
          </p>
        ))}
      </div>
    );
  }, [isDark, theme, tooltipBg, tooltipBorder]);

  // Render loading state
  if (isLoading) {
    return (
      <Paper p="md" withBorder>
        <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title order={3} style={{ margin: 0 }}>Heart Rate</Title>
          <Group>
            {(['day', 'week', 'month'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'filled' : 'outline'}
                size="xs"
                onClick={() => setTimeRange(range)}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Button>
            ))}
          </Group>
        </Box>
        <Box style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader />
        </Box>
      </Paper>
    );
  }

  // Render no data state
  if (!chartData.length) {
    return (
      <Paper p="md" withBorder>
        <Title order={3} mb="md">Heart Rate</Title>
        <Alert color="yellow" title="No Data">
          No heart rate data available. Please make sure your Apple Health data has been imported.
        </Alert>
      </Paper>
    );
  }

  // Type guard for month data
  // Type guard for month data
  const isMonthData = (point: ChartDataPoint): point is MonthDataPoint => {
    return 'avg' in point && 'min' in point && 'max' in point;
  };

  // Get current data point for display
  const currentData = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const currentBpm = currentData ? 
    (isMonthData(currentData) ? currentData.avg : 'bpm' in currentData ? (currentData as WeekDataPoint | DayDataPoint).bpm : 'N/A') : 
    'N/A';

  const chart = timeRange === 'month' ? (
    <AreaChart
      data={chartData}
      margin={{
        top: 10,
        right: 30,
        left: 0,
        bottom: 0,
      }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
      <XAxis 
        dataKey={xAxisKey} 
        tick={{ fill: tickColor }}
      />
      <YAxis 
        tick={{ fill: tickColor }}
        label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft' }}
      />
      <Tooltip 
        content={<CustomTooltip />}
        contentStyle={{
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          color: isDark ? theme.white : theme.black,
        }}
      />
      <Area 
        type="monotone" 
        dataKey="avg" 
        stroke={theme.colors.blue[6]} 
        fill={theme.colors.blue[0]} 
        fillOpacity={0.8}
        strokeWidth={2}
      />
      <Area 
        type="monotone" 
        dataKey="min" 
        stroke={theme.colors.gray[6]}
        strokeDasharray="3 3"
        strokeWidth={1}
        dot={false}
        activeDot={false}
      />
      <Area 
        type="monotone" 
        dataKey="max" 
        stroke={theme.colors.gray[6]}
        strokeDasharray="3 3"
        strokeWidth={1}
        dot={false}
        activeDot={false}
      />
    </AreaChart>
  ) : (
    <AreaChart
      data={chartData}
      margin={{
        top: 10,
        right: 30,
        left: 0,
        bottom: 0,
      }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
      <XAxis 
        dataKey={xAxisKey} 
        tick={{ fill: tickColor }}
      />
      <YAxis 
        tick={{ fill: tickColor }}
        label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft' }}
      />
      <Tooltip 
        content={<CustomTooltip />}
        contentStyle={{
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          color: isDark ? theme.white : theme.black,
        }}
      />
      <Area 
        type="monotone" 
        dataKey="bpm" 
        stroke={theme.colors.blue[6]} 
        fill={theme.colors.blue[0]} 
        fillOpacity={0.8}
        strokeWidth={2}
      />
      {timeRange === 'week' && (
        <Area 
          type="monotone" 
          dataKey="resting" 
          stroke={theme.colors.green[6]}
          fill={theme.colors.green[0]}
          fillOpacity={0.5}
          strokeWidth={2}
        />
      )}
    </AreaChart>
  );

  return (
    <Paper p="md" withBorder>
      <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title order={3} style={{ margin: 0 }}>Heart Rate</Title>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['day', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                border: 'none',
                background: timeRange === range 
                  ? theme.colors.blue[6] 
                  : isDark ? theme.colors.dark[5] : theme.colors.gray[2],
                color: timeRange === range ? 'white' : isDark ? theme.colors.gray[0] : theme.colors.gray[7],
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </Box>
      
      <Text c="dimmed" mb="lg">
        {timeRange === 'day' 
          ? 'Your heart rate throughout the day' 
          : timeRange === 'week'
            ? 'Your average heart rate by day' 
            : 'Your heart rate statistics by week'}
      </Text>
      
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
      
      <Box style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginTop: 16, 
        gap: '2rem',
        flexWrap: 'wrap'
      }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Box w={12} h={12} style={{ 
            backgroundColor: theme.colors.blue[6], 
            borderRadius: '50%' 
          }} />
          <Text size="sm" c="dimmed">
            {timeRange === 'month' ? 'Average' : 'Current'}
          </Text>
          <Text size="sm" fw={500}>
            {currentBpm !== 'N/A' ? `${currentBpm} bpm` : '--'}
          </Text>
        </Box>
        
        {timeRange === 'month' && chartData.length > 0 && (
          <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Box w={12} h={12} style={{ 
              backgroundColor: theme.colors.gray[6], 
              borderRadius: '50%', 
              opacity: 0.5 
            }} />
            <Text size="sm" c="dimmed">Range</Text>
            <Text size="sm" fw={500}>
              {currentData && isMonthData(currentData) ? 
                `${currentData.min} - ${currentData.max} bpm` : '--'}
            </Text>
          </Box>
        )}
        
        {timeRange === 'week' && chartData.length > 0 && (
          <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Box w={12} h={12} style={{ 
              backgroundColor: theme.colors.green[6], 
              borderRadius: '50%', 
              opacity: 0.5 
            }} />
            <Text size="sm" c="dimmed">Resting</Text>
            <Text size="sm" fw={500}>
              {(() => {
                // Resting heart rate is not available in the current data structure
                // This would need to be implemented based on your data source
                return '--';
              })()}
            </Text>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default HeartRateChart;

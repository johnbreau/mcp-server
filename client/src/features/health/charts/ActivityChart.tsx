import { useState, useEffect } from 'react';
import { Paper, Title, Text, useMantineTheme, Loader, Alert, useMantineColorScheme } from '@mantine/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { healthApiClient } from '../../../api/health';
import { transformActivityData } from '../utils/transformData';

export const ActivityChart = () => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [chartData, setChartData] = useState<ReturnType<typeof transformActivityData>>([]);
  const isDark = colorScheme === 'dark';
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivityData = async () => {
      try {
        setIsLoading(true);
        // Fetch activity data for the last 30 days
        const data = await healthApiClient.getActivityData(30);
        // Transform the data for the chart
        const transformedData = transformActivityData(data);
        // Ensure we only show the last 30 days in case we got more data
        setChartData(transformedData.slice(-30));
      } catch (err) {
        console.error('Error fetching activity data:', err);
        setError('Failed to load activity data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivityData();
  }, []);

  if (isLoading) {
    return (
      <Paper p="md" withBorder>
        <Title order={3} mb="md">Daily Activity</Title>
        <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader size="xl" />
        </div>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper p="md" withBorder>
        <Title order={3} mb="md">Daily Activity</Title>
        <Alert color="red" title="Error">
          {error}
        </Alert>
      </Paper>
    );
  }

  // Format date for X-axis to be more readable
  const formatXAxis = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Paper p="md" withBorder>
      <Title order={3} mb="md">30-Day Activity</Title>
      <Text c="dimmed" mb="lg">Your activity over the past 30 days</Text>
      
      {chartData.length > 0 ? (
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <LineChart
              data={chartData.map(day => ({
                ...day,
                date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }))}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? theme.colors.dark[5] : theme.colors.gray[2]} />
              <XAxis 
                dataKey="date" 
                tick={{ fill: isDark ? theme.colors.gray[4] : theme.colors.gray[7], fontSize: 12 }}
                tickFormatter={formatXAxis}
                tickMargin={10}
                interval={Math.floor(chartData.length / 10)} // Show ~10 labels
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                yAxisId="left" 
                tick={{ fill: isDark ? theme.colors.gray[4] : theme.colors.gray[7] }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                domain={[0, 'dataMax + 2']}
                tick={{ fill: isDark ? theme.colors.gray[6] : theme.colors.gray[3] }}
                stroke={isDark ? theme.colors.gray[6] : theme.colors.gray[3]}
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: isDark ? theme.colors.dark[7] : theme.white,
                  border: `1px solid ${isDark ? theme.colors.dark[5] : theme.colors.gray[3]}`,
                  borderRadius: theme.radius.md,
                }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="steps" 
                name="Steps" 
                stroke={isDark ? theme.colors.blue[4] : theme.colors.blue[6]}
                activeDot={{ r: 6, fill: isDark ? theme.colors.blue[4] : theme.colors.blue[6] }}
                strokeWidth={2}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="calories" 
                name="Calories (active)" 
                stroke={isDark ? theme.colors.gray[6] : theme.colors.gray[4]}
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="distance" 
                name="Distance (km)" 
                stroke={isDark ? theme.colors.green[4] : theme.colors.green[6]}
                activeDot={{ r: 6, fill: isDark ? theme.colors.green[4] : theme.colors.green[6] }}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Alert color="yellow" title="No Data">
          No activity data available. Please make sure your Apple Health data has been imported.
        </Alert>
      )}
    </Paper>
  );
};

export default ActivityChart;

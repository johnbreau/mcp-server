import { useState, useEffect, useCallback } from 'react';
import { format, isSameDay, subMonths, addMonths, parseISO } from 'date-fns';
import { 
  Box, 
  Text, 
  Title, 
  Button, 
  Group, 
  Container, 
  Paper, 
  useMantineTheme,
  useMantineColorScheme
} from '@mantine/core';
import { Calendar as MantineCalendar } from '@mantine/dates';
import '@mantine/dates/styles.css';

// Define the TimelineItem type based on the API response
type TimelineItem = {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: string;
  metadata?: Record<string, unknown>;
  source?: string;
};

/**
 * Calendar view component
 */
export default function CalendarView() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse date string to Date object if needed
  const parseDate = useCallback((date: Date | string | null): Date => {
    if (!date) return new Date();
    return date instanceof Date ? date : new Date(date);
  }, []);

  // Navigation handlers
  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth(current => subMonths(current, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(current => addMonths(current, 1));
  }, []);

  // Fetch events when the month changes
  const fetchEvents = useCallback(async (start: Date, end: Date) => {
    console.log('Fetching events...');
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching events from ${start} to ${end}`);

      // Format dates as YYYY-MM-DD for the API
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      console.log(`API URL: /api/timeline?start=${startStr}&end=${endStr}`);
      const response = await fetch(`/api/timeline?start=${startStr}&end=${endStr}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
      }

      interface ApiResponse {
        success: boolean;
        data: Array<{
          id: string;
          timestamp: string;
          title: string;
          description?: string;
          type: string;
          metadata?: Record<string, unknown>;
          source?: string;
        }>;
      }

      const responseData = await response.json() as ApiResponse;
      console.log('API Response:', responseData);

      if (!responseData.success) {
        throw new Error('Failed to fetch events: API returned unsuccessful response');
      }

      const eventsData = responseData.data || [];
      console.log('Received events:', eventsData);

      // Transform API response to TimelineItem format
      const transformedEvents = eventsData.map((item) => ({
        id: item.id,
        timestamp: item.timestamp, // Using timestamp instead of date
        title: item.title,
        description: item.description || '',
        type: item.type,
        metadata: item.metadata,
        source: item.source
      }));

      setEvents(transformedEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get events for the selected date
  const getEventsForDate = useCallback((date: string | Date | null): TimelineItem[] => {
    if (!date) return [];

    const targetDate = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(targetDate.getTime())) return [];

    return events.filter(event => {
      try {
        const eventDate = new Date(event.timestamp);
        return isSameDay(eventDate, targetDate);
      } catch (error) {
        console.error('Error processing event date:', error);
        return false;
      }
    });
  }, [events]);

  // Check if a date has any events
  const hasEvents = useCallback((date: Date): boolean => {
    return events.some(event => {
      try {
        const eventDate = new Date(event.timestamp);
        return isSameDay(eventDate, date);
      } catch (error) {
        console.error('Error processing event date:', error);
        return false;
      }
    });
  }, [events]);

  // Format the month and year for display
  const monthYear = format(currentMonth, 'MMMM yyyy');

  // Fetch events when the month changes
  useEffect(() => {
    if (!currentMonth) return;

    const firstDay = new Date(currentMonth);
    firstDay.setDate(1);

    const lastDay = new Date(currentMonth);
    lastDay.setMonth(lastDay.getMonth() + 1);
    lastDay.setDate(0);

    fetchEvents(firstDay, lastDay);
  }, [currentMonth, fetchEvents]);

  // Get events for the selected date
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <Container size="lg" py="xl">
      <Paper withBorder p="md" radius="md">
        <Title order={2} mb="md">Calendar</Title>
        <Group>
          <Button variant="subtle" onClick={handlePreviousMonth}>&lt; Prev</Button>
          <Text fw={500} style={{ fontWeight: 500 }}>{monthYear}</Text>
          <Button variant="subtle" onClick={handleNextMonth}>Next &gt;</Button>
        </Group>
        <Box mt="md">
          <MantineCalendar
            value={selectedDate}
            onChange={(date) => setSelectedDate(parseDate(date))}
            renderDay={(date) => {
              const dayDate = parseDate(date);
              const day = dayDate.getDate();
              const today = new Date();
              const dayHasEvents = hasEvents(dayDate);
              const isToday = isSameDay(dayDate, today);
              const isSelected = selectedDate ? isSameDay(dayDate, selectedDate) : false;

              return (
                <div
                  style={{
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: theme.radius.sm,
                    backgroundColor: isSelected
                      ? theme.colors.blue[6]
                      : 'transparent',
                    position: 'relative',
                    color: isSelected ? 'white' : 'inherit',
                    cursor: 'pointer',
color: isSelected ? 'white' : 'inherit',
                    border: isToday ? `2px solid ${theme.colors.blue[6]}` : 'none',
                    cursor: 'pointer',
  
                  }}
                  onClick={() => setSelectedDate(date)}
                >
                  {day}
                  {dayHasEvents && (
                    <div style={{
                      position: 'absolute',
                      bottom: 4,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'white' : theme.colors.blue[6],
                    }} />
                  )}
                </div>
              );
            }}
          />
        </Box>

        {selectedDate && (
          <Box mt="md">
            <Text fw={500} mb="sm">
              Events for {format(selectedDate, 'MMMM d, yyyy')}
            </Text>
            {isLoading ? (
              <Text>Loading events...</Text>
            ) : error ? (
              <Text c="red">{error}</Text>
            ) : selectedDateEvents.length === 0 ? (
              <Text c="dimmed">No events for this day</Text>
            ) : (
              <div>
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      padding: theme.spacing.xs,
                      marginBottom: theme.spacing.xs,
                      borderRadius: theme.radius.sm,
                      backgroundColor: colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[0],
    
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedDate(new Date(event.timestamp))}
                  >
                    <Text size="sm" fw={500}>{event.title}</Text>
                    {event.description && (
                      <Text size="xs" c="dimmed">{event.description}</Text>
                    )}
                    <Text size="xs" c="dimmed">
                      {formatEventTime(event.timestamp)}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </Box>
        )}
      </Paper>
    </Container>
  );
}

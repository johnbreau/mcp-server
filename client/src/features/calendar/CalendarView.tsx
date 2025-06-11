import { useState, useEffect, useCallback } from 'react';
import { format, isSameDay, subMonths, addMonths } from 'date-fns';
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

  // Format time for display
  const formatEventTime = useCallback((date: Date | string): string => {
    try {
      const dateObj = typeof date === 'string' ? parseDateString(date) : date;
      return format(dateObj, 'h:mm a');
    } catch (error) {
      console.error('Error formatting time:', error, date);
      return '';
    }
  }, []);

  // Handle date selection from the calendar
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // Handle calendar change event
  const handleCalendarChange = useCallback((date: string | Date | null) => {
    if (date) {
      const newDate = typeof date === 'string' ? new Date(date) : date;
      setSelectedDate(newDate);
    }
  }, []);

  // Navigation handlers
  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth(current => subMonths(current, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(current => addMonths(current, 1));
  }, []);

  // Handle date selection
  // const handleDateChange = useCallback((date: Date | null) => {
  //   if (date) {
  //     setSelectedDate(date);
  //   }
  // }, []);

  // Fetch events when the month changes
  const fetchEvents = useCallback(async (start: Date, end: Date) => {
    console.log('Fetching Apple Calendar events...');
    setIsLoading(true);
    setError(null);

    try {
      // Format dates as ISO strings for the API
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      console.log(`Fetching calendar events from ${startStr} to ${endStr}`);
      const response = await fetch(`/api/calendar/events?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`);
      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch calendar events: ${response.status} ${response.statusText}`);
      }

      interface CalendarEvent {
        id: string;
        title: string;
        start: string;
        end: string;
        description: string;
        location: string;
        isAllDay: boolean;
        calendar: string;
      }

      interface ApiResponse {
        success: boolean;
        data: CalendarEvent[];
      }

      const responseData = await response.json() as ApiResponse;
      console.log('Calendar API Response:', responseData);

      if (!responseData.success) {
        throw new Error('Failed to fetch calendar events: API returned unsuccessful response');
      }

      const eventsData = responseData.data || [];
      console.log('Received calendar events:', eventsData);

      // Transform calendar events to TimelineItem format
      const transformedEvents = eventsData.map((event) => ({
        id: event.id,
        timestamp: event.start, // Using event start time as timestamp
        title: event.title,
        description: event.description || '',
        type: 'event',
        metadata: {
          isAllDay: event.isAllDay,
          location: event.location,
          calendar: event.calendar,
          end: event.end
        },
        source: 'apple-calendar'
      }));

      setEvents(transformedEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper function to parse date strings from the API
  const parseDateString = (dateStr: string): Date => {
    // Try parsing with the format: "Sunday, June 8, 2025 at 12:00:00 PM"
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    // If that fails, try removing the "at" and parse again
    const cleanedStr = dateStr.replace(' at ', ' ');
    const cleanedParsed = new Date(cleanedStr);
    if (!isNaN(cleanedParsed.getTime())) {
      return cleanedParsed;
    }
    
    console.warn('Could not parse date string:', dateStr);
    return new Date(); // Fallback to current date
  };

  // Get events for the selected date
  const getEventsForDate = useCallback((date: string | Date | null): TimelineItem[] => {
    if (!date) return [];

    const targetDate = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(targetDate.getTime())) return [];

    return events.filter(event => {
      try {
        const eventDate = parseDateString(event.timestamp);
        return isSameDay(eventDate, targetDate);
      } catch (error) {
        console.error('Error processing event date:', error, event);
        return false;
      }
    });
  }, [events]);

  // Check if a date has any events
  const hasEvents = useCallback((date: Date): boolean => {
    return events.some(event => {
      try {
        const eventDate = parseDateString(event.timestamp);
        return isSameDay(eventDate, date);
      } catch (error) {
        console.error('Error processing event date:', error, event);
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
        <Box mt="md">
          <MantineCalendar
            getDayProps={(date) => ({
              onClick: () => handleCalendarChange(date),
            })}
            renderDay={(date) => {
              // Convert date to Date object if it's a string
              const dayDate = date ? new Date(date) : new Date();
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
                    border: isToday ? `2px solid ${theme.colors.blue[6]}` : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleDateSelect(dayDate)}
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
                {selectedDateEvents.map((event) => {
                  try {
                    const eventDate = parseDateString(event.timestamp);
                    return (
                      <div
                        key={event.id}
                        style={{
                          padding: '8px',
                          margin: '4px 0',
                          borderRadius: '4px',
                          backgroundColor: colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[0],
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedDate(eventDate)}
                      >
                        <Text size="sm" fw={500}>
                          {event.title}
                        </Text>
                        {event.description && (
                          <Text size="xs" c="dimmed">
                            {event.description}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          {formatEventTime(event.timestamp)}
                        </Text>
                      </div>
                    );
                  } catch (error) {
                    console.error('Error rendering event:', error, event);
                    return null;
                  }
                })}
              </div>
            )}
          </Box>
        )}
      </Paper>
    </Container>
  );
}

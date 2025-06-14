import { useState, useEffect, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import { api } from '../../api/obsidian';
import { 
  Box, 
  Text, 
  Title, 
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
 * Journals view component
 */
export default function JournalsView() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth] = useState<Date>(new Date());
  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journalEntry, setJournalEntry] = useState<{content: string, title: string} | null>(null);
  const [isJournalLoading, setIsJournalLoading] = useState(false);

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

  // Fetch journal entry for a specific date
  const fetchJournalEntry = useCallback(async (date: Date) => {
    setIsJournalLoading(true);
    try {
      // Format the date to match Obsidian's daily note format (e.g., 2025-06-11)
      const dateStr = format(date, 'yyyy-MM-dd');
      // Use the same API client as the SearchPage
      const notePath = `04_Journals/${dateStr}.md`;
      const noteContent = await api.getNote(notePath);
      
      setJournalEntry({
        content: noteContent.content,
        title: format(date, 'MMMM d, yyyy')
      });
    } catch (err) {
      console.error('Error fetching journal entry:', err);
      setError('Failed to load journal entry');
      setJournalEntry(null);
    } finally {
      setIsJournalLoading(false);
    }
  }, []);

  // Handle date selection from the calendar
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    fetchJournalEntry(date);
  }, [fetchJournalEntry]);

  // Handle calendar change event
  const handleCalendarChange = useCallback((date: string | Date | null) => {
    if (date) {
      const newDate = typeof date === 'string' ? new Date(date) : date;
      setSelectedDate(newDate);
    }
  }, []);

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

  // Fetch events when the month changes
  useEffect(() => {
    if (!currentMonth) return;

    const firstDay = new Date(currentMonth);
    firstDay.setDate(1);

    const lastDay = new Date(currentMonth);
    lastDay.setMonth(lastDay.getMonth() + 1);
    lastDay.setDate(0);

    fetchEvents(firstDay, lastDay);
    
    // Fetch journal entry for the selected date when month changes
    if (selectedDate) {
      fetchJournalEntry(selectedDate);
    }
  }, [currentMonth, fetchEvents, selectedDate, fetchJournalEntry]);
  
  // Fetch journal entry when component mounts
  useEffect(() => {
    if (selectedDate) {
      fetchJournalEntry(selectedDate);
    }
  }, [selectedDate, fetchJournalEntry]);

  // Get events for the selected date
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <Container size="lg" py="xl">
      <Paper withBorder p="md" radius="md">
        <Title className="journalsTitleBar" order={2} mb="md">Journals</Title>
        <Box mt="md" className='journalsBox'>
          <MantineCalendar
            className="journalsCalendar"
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
          <div className="journalEntries" style={{ flex: 2, marginTop: 0 }}>
            <Title className="journalEntryDate" order={3} mb="md">
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Journal Entry'}
            </Title>
            {isJournalLoading ? (
              <Text>Loading journal entry...</Text>
            ) : journalEntry ? (
              <Paper style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                <div style={{ lineHeight: 1.6 }}>
                  {journalEntry.content}
                </div>
              </Paper>
            ) : (
              <Text c="dimmed">No journal entry for this date</Text>
            )}
          </div>
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

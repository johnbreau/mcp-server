import { useState, useEffect, useCallback } from 'react';
import { Calendar as MantineCalendar } from '@mantine/dates';

import { Box, Text, Paper, Title, Button, Group } from '@mantine/core';
import { format, addMonths, subMonths, isSameDay, parseISO } from 'date-fns';

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
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // Handle month change
  const handleMonthChange = useCallback((date: string | Date) => {
    const newDate = typeof date === 'string' ? new Date(date) : date;
    setCurrentMonth(newDate);
  }, []);
  

  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        timestamp: item.timestamp,  // Using timestamp instead of date
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

  // Navigation handlers
  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth(current => subMonths(current, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(current => addMonths(current, 1));
  }, []);

  const handleDateSelect = useCallback((date: string | null) => {
    setSelectedDate(date);
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
  const hasEvents = useCallback((date: string | Date): boolean => {
    return getEventsForDate(date).length > 0;
  }, [getEventsForDate]);

  // Format time for display
  const formatEventTime = useCallback((dateStr: string): string => {
    try {
      const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
      return format(date, 'h:mm a');
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  }, []);

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
  const monthYearFormat = currentMonth ? format(currentMonth, 'MMMM yyyy') : '';

  return (
    <Paper p="md" shadow="sm" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>Calendar</Title>
        <Group>
          <Button variant="subtle" onClick={handlePreviousMonth}>&lt; Prev</Button>
          <Text fw={500}>{monthYearFormat}</Text>
          <Button variant="subtle" onClick={handleNextMonth}>Next &gt;</Button>
        </Group>
      </Group>

      <Box>
        <MantineCalendar
          defaultDate={currentMonth}
          onDateChange={handleMonthChange}
          renderDay={(date) => {
            if (!date) return null;
            const dateObj = new Date(date);
            const day = dateObj.getDate();
            const hasEvent = hasEvents(dateObj);
            const isSelected = selectedDate ? isSameDay(new Date(selectedDate), dateObj) : false;
            
            return (
              <div 
                onClick={() => handleDateSelect(dateObj.toISOString())}
                style={{
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--mantine-color-blue-1)' : 'transparent',
                  borderRadius: 'var(--mantine-radius-sm)',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {day}
                {hasEvent && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      backgroundColor: 'var(--mantine-color-blue-6)',
                    }}
                  />
                )}
              </div>
            );
          }}
        />
      </Box>

      {selectedDate && (
        <Box mt="md">
          <Text fw={500} mb="sm">
            Events for {format(new Date(selectedDate), 'MMMM d, yyyy')}
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
                <Box key={event.id} mb="sm" p="xs" style={{ borderLeft: '3px solid var(--mantine-color-blue-6)' }}>
                  <Text fw={500}>{event.title}</Text>
                  {event.description && (
                    <Text size="sm" c="dimmed">{event.description}</Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {formatEventTime(event.timestamp)}
                    {event.source && ` • ${event.source}`}
                  </Text>
                </Box>
              ))}
            </div>
          )}
        </Box>
      )}
    </Paper>
  );
}

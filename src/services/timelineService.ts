import { startOfDay, endOfDay, addDays, isValid } from 'date-fns';
import calendarService from './calendarService.js';

/**
 * Safely parses a date from various input types
 */
function parseDate(input: unknown): Date | null {
  if (!input) return null;
  
  try {
    // Handle Date objects directly
    if (input instanceof Date) {
      return isValid(input) ? input : null;
    }
    
    const dateStr = String(input);
    
    // Try to parse AppleScript date format: "Sunday, June 8, 2025 at 12:00:00 PM"
    const appleScriptDateMatch = dateStr.match(/([A-Za-z]+),\s+([A-Za-z]+)\s+(\d+),\s*(\d+)\s+at\s+(\d+):(\d+):(\d+)\s*([AP]M)/i);
    
    if (appleScriptDateMatch) {
      const [_, _weekday, month, day, year, hours, minutes, seconds, period] = appleScriptDateMatch;
      const monthMap: {[key: string]: number} = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
        'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
      };
      
      let hour = parseInt(hours, 10);
      if (period.toLowerCase() === 'pm' && hour < 12) hour += 12;
      if (period.toLowerCase() === 'am' && hour === 12) hour = 0;
      
      const date = new Date(
        parseInt(year, 10),
        monthMap[month.toLowerCase()],
        parseInt(day, 10),
        hour,
        parseInt(minutes, 10),
        parseInt(seconds, 10)
      );
      
      return isValid(date) ? date : null;
    }
    
    // Fall back to standard date parsing
    const date = new Date(dateStr);
    return isValid(date) ? date : null;
  } catch (error) {
    console.error('Error parsing date:', input, error);
    return null;
  }
}

/**
 * Safely converts a date to ISO string
 */
function toISOStringSafe(date: unknown): string | null {
  const d = parseDate(date);
  return d ? d.toISOString() : null;
}

interface ICalendarEvent {
  id: string;
  title: string;
  start: string;  // Can be ISO string or AppleScript date format
  end: string;    // Can be ISO string or AppleScript date format
  description: string;
  location: string;
  isAllDay: boolean;
  calendar: string;
}

export type TimelineItem = {
  type: 'journal' | 'event';
  timestamp: string;
  id: string;
  title: string;
  description: string;
  metadata: {
    location?: string;
    isAllDay?: boolean;
    calendar?: string;
    start?: string;
    end?: string;
    [key: string]: unknown;
  };
  source: string;
};

/**
 * Generates test events for development and fallback purposes
 */
function generateTestEvents(_startDate: Date, _endDate: Date): ICalendarEvent[] {
  console.log('Generating test events...');
  const events: ICalendarEvent[] = [];
  const today = new Date();
  
  // Helper function to create date strings
  const createDateStr = (date: Date): string => date.toISOString();
  
  // Add some test events
  const event1Start = new Date(today);
  event1Start.setHours(10, 0, 0, 0);
  const event1End = new Date(event1Start);
  event1End.setHours(11, 0, 0, 0);
  
  events.push({
    id: 'test-1',
    title: 'Team Meeting',
    start: createDateStr(event1Start),
    end: createDateStr(event1End),
    description: 'Weekly team sync',
    location: 'Zoom',
    isAllDay: false,
    calendar: 'Work'
  });
  
  const event2Start = new Date(today);
  event2Start.setHours(12, 30, 0, 0);
  const event2End = new Date(event2Start);
  event2End.setHours(13, 30, 0, 0);
  
  events.push({
    id: 'test-2',
    title: 'Lunch with Sarah',
    start: createDateStr(event2Start),
    end: createDateStr(event2End),
    description: 'Catch up over lunch',
    location: '',
    isAllDay: false,
    calendar: 'Personal'
  });
  
  const event3Date = startOfDay(addDays(today, 2));
  
  events.push({
    id: 'test-3',
    title: 'Project Deadline',
    start: createDateStr(event3Date),
    end: createDateStr(event3Date), // Same as start for all-day events
    description: 'Submit final project deliverables',
    location: '',
    isAllDay: true,
    calendar: 'Work'
  });
  
  return events;
}

export class TimelineService {
  private useTestData: boolean;
  
  constructor(useTestData: boolean = false) {
    this.useTestData = useTestData;
    console.log('TimelineService initialized', { useTestData });
  }

  /**
   * Fetches timeline items between the specified dates
   * @param startDate Start date (inclusive)
   * @param endDate End date (inclusive)
   * @returns Array of timeline items
   */
  async getTimeline(startDate: Date, endDate: Date): Promise<TimelineItem[]> {
    const logPrefix = '[TimelineService]';
    
    // Input validation with safe date parsing
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    if (!start || !end) {
      const error = new Error(`Invalid date range: ${startDate} to ${endDate}`);
      console.error(`${logPrefix} ${error.message}`);
      throw error;
    }
    
    if (start > end) {
      const error = new Error(`Start date (${start.toISOString()}) must be before end date (${end.toISOString()})`);
      console.error(`${logPrefix} ${error.message}`);
      throw error;
    }
    
    console.log(`${logPrefix} Fetching timeline from ${start.toISOString()} to ${end.toISOString()}`);
    
    const startOfRange = startOfDay(start);
    const endOfRange = endOfDay(end);
    
    console.log(`${logPrefix} Getting events between ${startOfRange.toISOString()} and ${endOfRange.toISOString()}`);
    
    let calendarEvents: ICalendarEvent[] = [];
    
    try {
      if (this.useTestData) {
        console.log(`${logPrefix} Using test data`);
        calendarEvents = generateTestEvents(startOfRange, endOfRange);
      } else {
        console.log(`${logPrefix} Fetching calendar events...`);
        const startTime = Date.now();
        calendarEvents = await calendarService.getEventsInRange(startOfRange, endOfRange);
        const duration = Date.now() - startTime;
        console.log(`${logPrefix} Fetched ${calendarEvents.length} events in ${duration}ms`);
      }
      
      // Log event count and first few events for debugging
      console.log(`${logPrefix} Found ${calendarEvents.length} calendar events`);
      
      if (calendarEvents.length > 0) {
        console.log(`${logPrefix} First few events:`, calendarEvents.slice(0, 3).map(e => ({
          id: e.id.substring(0, 8) + '...',
          title: e.title,
          start: e.start,
          end: e.end,
          calendar: e.calendar,
          isAllDay: e.isAllDay
        })));
      }
      
    } catch (error) {
      console.error(`${logPrefix} Error fetching calendar events:`, error);
      
      // Fall back to test data in case of error
      if (!this.useTestData) {
        console.log(`${logPrefix} Falling back to test data`);
        calendarEvents = generateTestEvents(start, end);
      } else {
        throw new Error('Failed to fetch events and test data is already in use');
      }
    }
    
    // Transform calendar events to timeline items with error handling
    const eventItems: TimelineItem[] = [];
    let skippedEvents = 0;
    
    for (const event of calendarEvents) {
      try {
        // Parse and validate dates
        const startDate = parseDate(event.start);
        if (!startDate) {
          console.warn(`${logPrefix} Skipping event with invalid start date:`, event);
          skippedEvents++;
          continue;
        }
        
        // Handle end date (default to 1 hour after start if not provided or invalid)
        const endDate = parseDate(event.end) || new Date(startDate.getTime() + 3600000);
        
        // Ensure end date is after start date
        const safeEndDate = endDate > startDate ? endDate : new Date(startDate.getTime() + 3600000);
        
        // Convert dates to ISO strings safely
        const startISO = toISOStringSafe(startDate);
        const endISO = toISOStringSafe(safeEndDate);
        
        if (!startISO) {
          console.warn(`${logPrefix} Skipping event with invalid date format:`, event);
          skippedEvents++;
          continue;
        }
        
        // Create timeline item with safe date handling
        const timelineItem: TimelineItem = {
          type: 'event',
          timestamp: startISO,
          id: event.id || `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: event.title || 'Untitled Event',
          description: event.description || '',
          metadata: {
            location: event.location || '',
            isAllDay: event.isAllDay || false,
            calendar: event.calendar || 'Unknown',
            start: startISO,
            end: endISO || startISO // Fallback to start date if end date is invalid
          },
          source: 'calendar'
        };
        
        eventItems.push(timelineItem);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${logPrefix} Error processing event:`, errorMessage);
        // Continue with other events if one fails
        continue;
      }
    }
    
    // Get journal items (currently empty array)
    const journalItems: TimelineItem[] = [];
    
    // Combine and sort all items by timestamp
    const allItems = [...eventItems, ...journalItems].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    console.log(`${logPrefix} Successfully processed ${allItems.length} timeline items`);
    return allItems;
  }

  /**
   * Gets a random journal entry (placeholder implementation)
   */
  async getRandomJournalEntry(): Promise<TimelineItem | null> {
    // This is a placeholder implementation
    // In a real app, this would fetch a random journal entry from your data store
    return {
      type: 'journal',
      id: `journal-${Date.now()}`,
      timestamp: new Date().toISOString(),
      title: 'Sample Journal Entry',
      description: 'This is a sample journal entry',
      metadata: {},
      source: 'journal'
    };
  }
}

// Create a singleton instance - always use real calendar data
export const timelineService = new TimelineService(false);

import { Router } from 'express';
import calendarService from '../services/calendarService.js';
import { parseISO, isValid } from 'date-fns';

const router = Router();

// Timeout constants
const REQUEST_TIMEOUT = 30000; // 30 seconds for the entire request
const CALENDAR_TIMEOUT = 25000; // 25 seconds for calendar operations
const MAX_DAYS_RANGE = 30; // Maximum days to fetch in a single request

// Helper function to safely parse and validate date
const parseAndValidateDate = (dateStr: unknown, defaultValue: Date): Date => {
  if (!dateStr || typeof dateStr !== 'string') return defaultValue;
  const parsed = parseISO(dateStr);
  return isValid(parsed) ? parsed : defaultValue;
};

// Get calendar events for a date range
router.get('/events', async (req, res) => {
  // Set response timeout
  let requestCompleted = false;
  const timeout = setTimeout(() => {
    if (!requestCompleted && !res.headersSent) {
      requestCompleted = true;
      res.status(504).json({
        success: false,
        error: 'Request timeout',
        details: 'The request took too long to process',
        timestamp: new Date().toISOString()
      });
    }
  }, REQUEST_TIMEOUT);
  
  // Helper function to send response and clean up
  const sendResponse = (status: number, response: any) => {
    if (!requestCompleted) {
      requestCompleted = true;
      clearTimeout(timeout);
      return res.status(status).json(response);
    }
    return undefined;
  };
  
  // Ensure timeout is cleared if response is sent
  const cleanup = () => {
    if (!requestCompleted) {
      clearTimeout(timeout);
    }
  };
  
  try {
    // Set up cleanup on response finish/close
    res.on('finish', cleanup);
    res.on('close', cleanup);
    
    // Parse query parameters with defaults
    const now = new Date();
    const defaultStartDate = new Date(now);
    const defaultEndDate = new Date(now);
    defaultEndDate.setDate(defaultEndDate.getDate() + 7); // Default to next 7 days
    
    let startDate = parseAndValidateDate(req.query.start, defaultStartDate);
    let endDate = parseAndValidateDate(req.query.end, defaultEndDate);
    
    // Ensure start date is before end date
    if (startDate > endDate) {
      // If dates are reversed, swap them
      [startDate, endDate] = [endDate, startDate];
    }
    
    // Limit date range to MAX_DAYS_RANGE days
    const maxEndDate = new Date(startDate);
    maxEndDate.setDate(startDate.getDate() + MAX_DAYS_RANGE);
    
    if (endDate > maxEndDate) {
      console.log(`Limiting date range to ${MAX_DAYS_RANGE} days`);
      endDate = new Date(maxEndDate);
    }

    console.log(`Fetching calendar events from ${startDate} to ${endDate}`);
    
    // Fetch events with timeout and detailed logging
    const fetchEvents = async () => {
      console.log(`[Calendar] Starting to fetch events from ${startDate} to ${endDate}`);
      const startTime = Date.now();
      
      try {
        console.log('[Calendar] Calling calendarService.getEventsInRange()');
        const events = await calendarService.getEventsInRange(startDate, endDate);
        const duration = Date.now() - startTime;
        console.log(`[Calendar] Successfully fetched ${events.length} events in ${duration}ms`);
        return events;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const duration = Date.now() - startTime;
        console.error(`[Calendar] Error after ${duration}ms:`, error);
        throw new Error(`Failed to fetch calendar events after ${duration}ms: ${error.message}`);
      }
    };
    
    // Execute with timeout
    const events = await Promise.race([
      fetchEvents(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Calendar operation timed out')), CALENDAR_TIMEOUT)
      )
    ]);
    
    // Return successful response
    return sendResponse(200, {
      success: true,
      data: events,
      count: Array.isArray(events) ? events.length : 0,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error processing calendar request:', error);
    if (!requestCompleted) {
      return sendResponse(500, {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // If we get here, the request was already handled
  return undefined;
});

export default router;

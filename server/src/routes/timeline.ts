import { Router } from 'express';
import { timelineService } from '../services/timelineService.js';
import { parseISO, startOfDay, endOfDay, subDays, isValid } from 'date-fns';

// Timeout constants
const REQUEST_TIMEOUT = 120000; // 2 minutes for the entire request
const CALENDAR_TIMEOUT = 60000; // 60 seconds for calendar operations

const router = Router();

// Helper function to safely parse and validate date
const parseAndValidateDate = (dateStr: unknown, defaultValue: Date): Date => {
  if (!dateStr || typeof dateStr !== 'string') return defaultValue;
  const parsed = parseISO(dateStr);
  return isValid(parsed) ? parsed : defaultValue;
};

// Get timeline for a date range
router.get('/', async (req, res) => {
  // Set response timeout
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: 'Request timeout',
        details: 'The request took too long to process',
        timestamp: new Date().toISOString()
      });
    }
  }, REQUEST_TIMEOUT);
  
  // Ensure timeout is cleared if response is sent
  const cleanup = () => {
    clearTimeout(timeout);
  };
  
  try {
    // Set up cleanup on response finish/close
    res.on('finish', cleanup);
    res.on('close', cleanup);
    
    // Parse query parameters with defaults
    const defaultStartDate = startOfDay(subDays(new Date(), 7));
    const defaultEndDate = endOfDay(new Date());
    
    const startDate = parseAndValidateDate(req.query.start, defaultStartDate);
    const endDate = parseAndValidateDate(req.query.end, defaultEndDate);
    
    // Ensure start date is before end date
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range',
        details: 'Start date must be before end date',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[Timeline Route] Fetching timeline from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Fetch timeline with timeout
    const fetchTimeline = async () => {
      try {
        console.log('[Timeline Route] Calling timelineService.getTimeline');
        const events = await timelineService.getTimeline(startDate, endDate);
        console.log(`[Timeline Route] Successfully retrieved ${events.length} events`);
        return events;
      } catch (error) {
        console.error('[Timeline Route] Error in timelineService.getTimeline:', error);
        throw error; // Re-throw to be handled by the outer catch
      }
    };
    
    // Execute with timeout
    let timeline;
    try {
      timeline = await Promise.race([
        fetchTimeline(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Calendar operation timed out')), CALENDAR_TIMEOUT)
        )
      ]);
    } catch (error) {
      console.error('[Timeline Route] Error in Promise.race:', error);
      throw error; // Re-throw to be handled by the outer catch
    }
    
    // Send successful response
    return res.json({
      success: true,
      data: timeline,
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        count: timeline.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    // Ensure we don't send headers twice
    if (res.headersSent) {
      console.error('[Timeline Route] Headers already sent, but encountered error:', error);
      return;
    }
    
    console.error('[Timeline Route] Error processing timeline request:', error);
    
    // Handle different types of errors
    let errorMessage = 'An unexpected error occurred';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      const details = error.stack || '';
      
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        statusCode = 504; // Gateway Timeout
      } else if (error.message.includes('permission') || error.message.includes('access')) {
        statusCode = 403; // Forbidden
      } else if (error.message.includes('not found')) {
        statusCode = 404; // Not Found
      } else {
        statusCode = 400; // Bad Request for other errors
      }
      
      console.error(`[Timeline Route] Error details: ${details}`);
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    // Log the error for debugging
    console.error('Error in timeline route:', error);
    
    // Send error response
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: 'Failed to process timeline request',
      timestamp: new Date().toISOString()
    });
  }
});

// Get a random journal entry
router.get('/random-journal', async (_req, res) => {
  try {
    const entry = await timelineService.getRandomJournalEntry();
    
    if (!entry) {
      res.status(404).json({
        success: false,
        error: 'No journal entries found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('Error getting random journal entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve random journal entry',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

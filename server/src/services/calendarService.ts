import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const exec = promisify(execCb);

interface ICalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
  location: string;
  isAllDay: boolean;
  calendar: string;
}

class CalendarService {
  private static instance: CalendarService;

  private constructor() {}

  public static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  private getAppleScript(startDate: Date, endDate: Date): string {
    // Format dates as YYYY,MM,DD,HH,MM,SS for AppleScript
    const formatDateForAppleScript = (date: Date) => {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1, // 0-indexed in JS
        day: date.getDate(),
        hours: date.getHours(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds()
      };
    };

    const start = formatDateForAppleScript(startDate);
    const end = formatDateForAppleScript(endDate);
    
    console.log('AppleScript date range:', { start, end });

    return `
    -- Helper function to replace text in a string
    on replaceText(theText, searchString, replacementString)
      try
        if theText is missing value then return ""
        set {oldTID, AppleScript's text item delimiters} to {AppleScript's text item delimiters, searchString}
        set textItems to text items of (theText as text)
        set AppleScript's text item delimiters to replacementString
        set resultText to textItems as text
        set AppleScript's text item delimiters to oldTID
        return resultText
      on error
        set AppleScript's text item delimiters to ""
        return theText as text
      end try
    end replaceText
    
    on run
      set eventDelimiter to "###EVENT_DELIMITER###"
      
      try
        -- Set date objects
        set startDate to current date
        set year of startDate to ${start.year}
        set month of startDate to ${start.month}
        set day of startDate to ${start.day}
        set hours of startDate to ${start.hours}
        set minutes of startDate to ${start.minutes}
        set seconds of startDate to ${start.seconds}
        
        set endDate to current date
        set year of endDate to ${end.year}
        set month of endDate to ${end.month}
        set day of endDate to ${end.day}
        set hours of endDate to ${end.hours}
        set minutes of endDate to ${end.minutes}
        set seconds of endDate to ${end.seconds}
        
        log "Searching for events between " & (startDate as text) & " and " & (endDate as text)
        
        tell application "Calendar"
          set output to ""
          set eventCount to 0
          
          -- Get all calendars
          set allCals to every calendar
          log "Found " & (count of allCals) & " calendars"
          
          -- Limit to main calendars to improve performance
          set targetCals to {}
          repeat with cal in allCals
            set calName to name of cal
            if calName is in {"Home", "Work", "Personal", "Family"} then
              copy cal to end of targetCals
            end if
          end repeat
          
          if (count of targetCals) is 0 then
            set targetCals to allCals
          end if
          
          log "Checking " & (count of targetCals) & " calendars..."
          
          -- Get events from each calendar
          repeat with cal in targetCals
            set calName to name of cal
            log "Checking calendar: " & calName
            
            try
              -- Get events in the specified date range
              set calEvents to (every event of cal whose \
                ((start date ≥ startDate and start date ≤ endDate) or \
                 (end date ≥ startDate and end date ≤ endDate) or \
                 (start date ≤ startDate and end date ≥ endDate)))
              
              set eventCountInCal to count of calEvents
              log "Found " & eventCountInCal & " events in calendar: " & calName
              
              -- Process each event
              if eventCountInCal > 0 then
                repeat with evt in calEvents
                  try
                    set eventId to id of evt
                    set eventTitle to summary of evt
                    set eventStart to start date of evt
                    set eventEnd to end date of evt
                    set eventLocation to ""
                    set eventDescription to ""
                    
                    -- Safely get optional properties
                    try
                      set eventLocation to location of evt
                    end try
                    
                    try
                      set eventDescription to description of evt
                    end try
                    
                    set isAllDay to allday event of evt
                    
                    -- Clean up the data
                    if eventTitle is missing value then set eventTitle to "(No Title)"
                    if eventLocation is missing value then set eventLocation to ""
                    if eventDescription is missing value then set eventDescription to ""
                    
                    -- Replace any pipe characters in the data to avoid parsing issues
                    set eventTitle to my replaceText(eventTitle as text, "|", " - ")
                    set eventLocation to my replaceText(eventLocation as text, "|", " - ")
                    set eventDescription to my replaceText(eventDescription as text, "|", " - ")
                    
                    -- Format the event data as a pipe-separated string
                    set eventData to eventId & "|" & eventTitle & "|" & (eventStart as text) & "|" & (eventEnd as text) & "|" & isAllDay & "|" & calName & "|" & eventLocation & "|" & eventDescription
                    
                    -- Add to output with a unique delimiter
                    if length of output > 0 then
                      set output to output & eventDelimiter
                    end if
                    set output to output & eventData
                    set eventCount to eventCount + 1
                    
                  on error errMsg
                    log ("Error processing event: " & errMsg)
                  end try
                end repeat
              end if
            on error errMsg
              log ("Error processing calendar " & calName & ": " & errMsg)
            end try
          end repeat
          
          -- Return the results or a message if no events found
          log "Total events found: " & eventCount
          if eventCount > 0 then
            return "SUCCESS: " & output
          else
            return "SUCCESS: No events found"
          end if
        end tell
        
      on error errMsg
        set errorMsg to "ERROR: " & errMsg & " " & (get name of (info for (path to me)) as text)
        log errorMsg
        return errorMsg
      end try
    end run
    `;
  }

  public async getEventsInRange(startDate: Date, endDate: Date): Promise<ICalendarEvent[]> {
    const appleScript = this.getAppleScript(startDate, endDate);
    
    try {
      console.log('Executing AppleScript to fetch calendar events...');
      console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());
      
      // Write the script to a temporary file to avoid shell escaping issues
      const tempFile = '/tmp/calendar_script.scpt';
      
      // Write the script to a file
      writeFileSync(tempFile, appleScript);
      console.log('AppleScript written to temporary file:', tempFile);
      
      // Execute the script file directly with increased timeout
      console.log('Executing AppleScript with 2 minute timeout...');
      const { stdout, stderr } = await exec(`osascript ${tempFile}`, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 120000, // 2 minutes
        env: { 
          ...process.env,
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
          SHELL: process.env.SHELL || '/bin/zsh'
        }
      });
      
      console.log('AppleScript execution completed');
      console.log('stdout length:', stdout?.length || 0);
      console.log('stderr length:', stderr?.length || 0);
      
      // Clean up the temporary file
      try { 
        unlinkSync(tempFile); 
        console.log('Temporary file cleaned up');
      } catch (e) { 
        console.error('Error cleaning up temporary file:', e);
      }
      
      if (stderr) {
        console.error('AppleScript stderr:', stderr);
      }
      
      if (stdout) {
        console.log('AppleScript output:', stdout);
        
        // Check for specific error patterns in the output
        if (stdout.includes('ERROR:')) {
          console.error('Error in AppleScript output:', stdout);
          return [];
        }
        
        if (stdout.trim() === '') {
          console.log('AppleScript executed but returned no output');
          return [];
        }
        
        const parsedEvents = this.parseAppleScriptOutput(stdout);
        console.log(`Successfully parsed ${parsedEvents.length} events`);
        return parsedEvents;
      } else {
        console.log('AppleScript executed successfully but returned no output');
        return [];
      }
    } catch (error) {
      console.error('Error executing AppleScript:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
          signal: (error as any).signal
        });
      }
      return [];
    }
  }
  
  private parseAppleScriptOutput(output: string): ICalendarEvent[] {
    const events: ICalendarEvent[] = [];
    
    if (output && output.startsWith('SUCCESS: ')) {
      const eventData = output.substring(9); // Remove 'SUCCESS: ' prefix
      
      if (eventData === 'No events found') {
        console.log('No events found in the specified date range');
        return [];
      }
      
      // Split events by the delimiter and filter out any empty strings
      const eventStrings = eventData.split('###EVENT_DELIMITER###').filter(s => s.trim());
      
      for (const eventStr of eventStrings) {
        if (!eventStr.trim()) continue;
        
        try {
          // Split by pipe, but ensure we don't split on escaped pipes
          const parts = [];
          let currentPart = '';
          let inQuotes = false;
          
          for (let i = 0; i < eventStr.length; i++) {
            const char = eventStr[i];
            const nextChar = i < eventStr.length - 1 ? eventStr[i + 1] : null;
            
            if (char === '\\' && nextChar === '|') {
              // Escaped pipe, add to current part and skip the next char
              currentPart += '|';
              i++; // Skip the next character
            } else if (char === '|' && !inQuotes) {
              // Found a field delimiter, push the current part
              parts.push(currentPart);
              currentPart = '';
            } else {
              currentPart += char;
            }
          }
          
          // Push the last part
          if (currentPart !== '') {
            parts.push(currentPart);
          }
          
          // Ensure we have at least 8 parts (id, title, start, end, isAllDay, calendar, location, description)
          while (parts.length < 8) {
            parts.push('');
          }
          
          const [id, title, start, end, isAllDay, calendar, location, description] = parts;
          
          // Clean up the values
          const cleanId = (id || '').trim();
          const cleanTitle = (title || '').trim() || '(No Title)';
          const cleanStart = (start || '').trim();
          const cleanEnd = (end || '').trim();
          const cleanIsAllDay = isAllDay === 'true';
          const cleanCalendar = (calendar || '').trim();
          const cleanLocation = (location || '').trim();
          const cleanDescription = (description || '').trim();
          
          // Only add the event if we have a valid ID and dates
          if (cleanId) {
            events.push({
              id: cleanId,
              title: cleanTitle,
              start: cleanStart,
              end: cleanEnd,
              isAllDay: cleanIsAllDay,
              calendar: cleanCalendar,
              location: cleanLocation,
              description: cleanDescription
            });
          }
        } catch (error) {
          console.error('Error parsing event:', error);
          console.error('Problematic event string:', eventStr);
        }
      }
    }
    
    return events;
  }
}

// Export the singleton instance
export default CalendarService.getInstance();

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
declare class CalendarService {
    private static instance;
    private constructor();
    static getInstance(): CalendarService;
    private getAppleScript;
    getEventsInRange(startDate: Date, endDate: Date): Promise<ICalendarEvent[]>;
    private parseAppleScriptOutput;
}
declare const _default: CalendarService;
export default _default;

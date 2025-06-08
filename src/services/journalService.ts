import fs from 'fs/promises';
import path from 'path';
import { parse } from 'date-fns';

type JournalEntry = {
  date: Date;
  content: string;
  path: string;
  wordCount: number;
};

export class JournalService {
  private journalPath: string;

  constructor(journalPath: string) {
    this.journalPath = journalPath;
  }

  async getEntryByDate(date: Date): Promise<JournalEntry | null> {
    const dateStr = this.formatDateForFilename(date);
    const year = date.getFullYear().toString();
    
    try {
      const filePath = path.join(this.journalPath, year, `${dateStr}.md`);
      const content = await fs.readFile(filePath, 'utf-8');
      
      return {
        date,
        content,
        path: filePath,
        wordCount: content.split(/\s+/).length
      };
    } catch (error) {
      console.error(`Error reading journal entry for ${dateStr}:`, error);
      return null;
    }
  }

  async getRandomEntry(): Promise<JournalEntry | null> {
    try {
      // Get all journal years
      const years = (await fs.readdir(this.journalPath, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
        .map(dirent => dirent.name);
      
      if (years.length === 0) return null;
      
      // Pick a random year
      const randomYear = years[Math.floor(Math.random() * years.length)];
      const yearPath = path.join(this.journalPath, randomYear);
      
      // Get all journal entries for that year
      const entries = (await fs.readdir(yearPath, { withFileTypes: true }))
        .filter(dirent => dirent.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/.test(dirent.name))
        .map(dirent => dirent.name);
      
      if (entries.length === 0) return null;
      
      // Pick a random entry
      const randomEntry = entries[Math.floor(Math.random() * entries.length)];
      const entryPath = path.join(yearPath, randomEntry);
      const content = await fs.readFile(entryPath, 'utf-8');
      
      // Parse date from filename (format: YYYY-MM-DD.md)
      const dateStr = randomEntry.replace(/\.md$/, '');
      const date = parse(dateStr, 'yyyy-MM-dd', new Date());
      
      return {
        date,
        content,
        path: entryPath,
        wordCount: content.split(/\s+/).length
      };
    } catch (error) {
      console.error('Error getting random journal entry:', error);
      return null;
    }
  }

  async getEntriesInRange(startDate: Date, endDate: Date): Promise<JournalEntry[]> {
    const entries: JournalEntry[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const entry = await this.getEntryByDate(currentDate);
      if (entry) {
        entries.push(entry);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return entries;
  }

  private formatDateForFilename(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Create a singleton instance
export const journalService = new JournalService(
  path.join(process.env.OBSIDIAN_VAULT_PATH || '', '04_Journals')
);

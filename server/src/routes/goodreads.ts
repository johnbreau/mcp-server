import { Request, Response, Router } from 'express';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env') });

// Interface for Book type
interface Book {
  title: string;
  author: string;
  coverImage: string;
  rating: string | number;
  dateRead: string;
  link?: string;
}

const router = Router();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CACHE_DIR = join(process.cwd(), '.cache');
const CACHE_FILE = join(CACHE_DIR, 'goodreads-cache.json');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

// Helper function to read from cache
function readFromCache(): { data: any; timestamp: number } | null {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error reading cache:', error);
  }
  return null;
}

// Helper function to write to cache
function writeToCache(data: any): void {
  try {
    writeFileSync(
      CACHE_FILE,
      JSON.stringify({
        data,
        timestamp: Date.now()
      }, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

// Helper function to create a delay with jitter
const delay = (minMs: number, maxMs?: number): Promise<void> => {
  const ms = maxMs !== undefined 
    ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs 
    : minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Function to log page state
async function logPageState(page: Page): Promise<void> {
  try {
    console.log('Page URL:', page.url());
    console.log('Page title:', await page.title().catch(() => 'Could not get title'));
  } catch (e) {
    console.log('Could not log page state:', e);
  }
}

// Helper function to create a new page with consistent settings
async function createNewPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({
    width: 1280 + Math.floor(Math.random() * 200),
    height: 800 + Math.floor(Math.random() * 200)
  });
  return page;
}

// Helper function to extract books from a page
async function extractBooksFromPage(page: Page): Promise<Book[]> {
  console.log('Extracting books from page...');
  
  try {
    await page.waitForSelector('tr.bookalike', { timeout: 10000 });
  } catch (error) {
    console.error('Could not find any books on the page');
    try {
      if (!page.isClosed()) {
        await logPageState(page);
      }
    } catch (e) {
      console.error('Error in page state logging:', e);
    }
    return [];
  }
  
  return page.evaluate((): Book[] => {
    const books: Book[] = [];
    const bookIds = new Set<string>();
    
    document.querySelectorAll('tr.bookalike').forEach(row => {
      try {
        const titleElement = row.querySelector('.title a') as HTMLAnchorElement;
        const authorElement = row.querySelector('.author a') as HTMLAnchorElement;
        // Try multiple selectors to find the cover image
        const coverElement = row.querySelector('img.bookCover') || 
                          row.querySelector('.bookCover img') ||
                          row.querySelector('img[src*="i.gr-assets.com"]') ||
                          row.querySelector('img[src*="s.gr-assets.com"]') ||
                          row.querySelector('img[src*="images.gr-assets.com"]') ||
                          row.querySelector('img[src*="nophoto"]');
        const ratingElement = row.querySelector('.rating .staticStars') as HTMLSpanElement;
        const dateElement = row.querySelector('.date_read_value') as HTMLSpanElement;
        
        if (!titleElement || !authorElement) return;
        
        const bookId = titleElement.href.split('/').pop()?.split('-')[0];
        if (bookId && bookIds.has(bookId)) return;
        if (bookId) bookIds.add(bookId);
        
        let coverImage = '';
        if (coverElement) {
          let src = coverElement.getAttribute('src') || '';
          if (src) {
            // Convert relative URLs to absolute
            if (src.startsWith('//')) {
              src = 'https:' + src;
            } else if (src.startsWith('/')) {
              src = 'https://www.goodreads.com' + src;
            }
            
            // Clean up the URL to get a larger image
            coverImage = src
              .replace(/\/s[0-9]+x[0-9]+\//, '/l')  // Replace size with '/l' for large
              .replace(/\.[^.]*_SX[0-9]+_/, '_SX200_')  // Standardize width to 200px
              .replace(/_SY[0-9]+_/, '_SY200_')  // Standardize height to 200px
              .replace(/_SX[0-9]+_/, '_SX200_')  // Catch any remaining width variations
              .replace('_SY75_', '_SY200_')  // Replace small heights
              .replace('_SY100_', '_SY200_')
              .replace('_SY150_', '_SY200_');
          }
        }
        
        books.push({
          title: titleElement.textContent?.trim() || 'Unknown Title',
          author: authorElement.textContent?.trim() || 'Unknown Author',
          coverImage,
          rating: ratingElement?.title?.match(/\d+\.?\d*/)?.[0] || '0',
          dateRead: dateElement?.textContent?.trim() || '',
          link: titleElement.href
        });
      } catch (error) {
        console.error('Error processing book row:', error);
      }
    });
    
    return books;
  });
}

// Helper function to check for next page
async function hasNextPage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const nextButton = document.querySelector('a.next_page:not(.disabled)');
    return !!nextButton;
  });
}

// Helper function to navigate to next page
async function goToNextPage(page: Page): Promise<boolean> {
  try {
    const clicked = await page.evaluate(() => {
      const nextButton = document.querySelector('a.next_page:not(.disabled)') as HTMLAnchorElement;
      if (nextButton) {
        nextButton.click();
        return true;
      }
      return false;
    });
    
    if (clicked) {
      await page.waitForLoadState('networkidle');
      await delay(2000, 3000);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error navigating to next page:', error);
    return false;
  }
}

// Extract books with retry logic
async function extractBooksWithRetry(page: Page, retries = 3, delayMs = 2000): Promise<Book[]> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Extracting books (attempt ${i + 1}/${retries})...`);
      const books = await extractBooksFromPage(page);
      if (books && books.length > 0) {
        return books;
      }
      throw new Error('No books extracted');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${i + 1} failed:`, lastError.message);
      if (i < retries - 1) {
        await delay(delayMs);
      }
    }
  }
  throw lastError || new Error('Failed to extract books after multiple attempts');
}

// Main route handler
router.get('/read', async (req: Request, res: Response) => {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Check cache first if not busting
    const bustCache = req.query.bustCache === 'true';
    const cache = !bustCache ? readFromCache() : null;
    
    if (cache && (Date.now() - cache.timestamp < CACHE_TTL)) {
      console.log('Returning cached data');
      return res.json({
        ...cache.data,
        fromCache: true,
        cachedAt: new Date(cache.timestamp).toISOString(),
        cacheBusted: false
      });
    }
    
    console.log(bustCache ? 'Cache bust requested' : 'Cache miss or expired');
    
    const GOODREADS_USER_ID = process.env.GOODREADS_USER_ID;
    if (!GOODREADS_USER_ID) {
      throw new Error('GOODREADS_USER_ID is not configured');
    }
    
    // Launch browser with retry logic
    const MAX_RETRIES = 3;
    let browserLaunched = false;
    
    for (let i = 0; i < MAX_RETRIES && !browserLaunched; i++) {
      try {
        console.log(`Launching browser (attempt ${i + 1}/${MAX_RETRIES})...`);
        browser = await chromium.launch({
          headless: true,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--no-zygote',
            '--single-process',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--no-first-run',
            '--no-default-browser-check'
          ],
          timeout: 120000,
          ignoreDefaultArgs: ['--disable-extensions']
        });
        
        browserLaunched = true;
        console.log('Browser launched successfully');
      } catch (error) {
        console.error(`Browser launch attempt ${i + 1} failed:`, error);
        if (i === MAX_RETRIES - 1) throw error;
        await delay(2000 * (i + 1));
      }
    }
    
    if (!browser) {
      throw new Error('Failed to launch browser after multiple attempts');
    }
    
    // Create browser context
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: {
        width: 1280 + Math.floor(Math.random() * 200),
        height: 800 + Math.floor(Math.random() * 200)
      },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    // Create new page
    page = await createNewPage(context);
    
    // Navigate to Goodreads
    const GOODREADS_URL = `https://www.goodreads.com/review/list/${GOODREADS_USER_ID}?shelf=read&per_page=100`;
    console.log(`Navigating to ${GOODREADS_URL}...`);
    
    await page.goto(GOODREADS_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Wait for books to load
    await page.waitForSelector('tr.bookalike', { timeout: 10000 });
    
    // Extract books from the first page
    const allBooks = await extractBooksWithRetry(page);
    console.log(`Extracted ${allBooks.length} books from first page`);
    
    // Handle pagination
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages && page) {
      console.log(`Processing page ${pageNum + 1}...`);
      
      const nextPageExists = await hasNextPage(page);
      if (!nextPageExists) {
        console.log('No more pages found');
        break;
      }
      
      const success = await goToNextPage(page);
      if (!success) {
        console.log('Failed to navigate to next page');
        break;
      }
      
      try {
        const pageBooks = await extractBooksWithRetry(page);
        if (pageBooks.length > 0) {
          allBooks.push(...pageBooks);
          console.log(`Extracted ${pageBooks.length} books from page ${pageNum + 1}`);
          pageNum++;
          
          // Random delay between page loads
          await delay(3000, 7000);
        } else {
          console.log('No books found on page, stopping pagination');
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error processing page ${pageNum + 1}:`, error instanceof Error ? error.message : 'Unknown error');
        hasMorePages = false;
      }
    }
    
    // Prepare and cache the response
    const responseData = {
      success: true,
      books: allBooks,
      stats: {
        totalBooks: allBooks.length,
        pagesProcessed: pageNum
      },
      fromCache: false,
      cachedAt: new Date().toISOString(),
      cacheBusted: bustCache
    };
    
    // Write to cache
    writeToCache({
      books: allBooks,
      stats: {
        totalBooks: allBooks.length,
        pagesProcessed: pageNum
      }
    });
    
    // Send response
    console.log(`Sending response with ${allBooks.length} books`);
    return res.json(responseData);
    
  } catch (error) {
    console.error('Error in /api/books/read:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch books',
      details: errorMessage,
      timestamp: new Date().toISOString()
    });
    
  } finally {
    // Clean up resources
    try {
      if (page && !page.isClosed()) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
  }
});

export default router;

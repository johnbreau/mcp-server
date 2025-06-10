import { Request, Response, Router } from 'express';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';
import { chromium } from 'playwright';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env') });

const router = Router();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface Book {
  title: string;
  author: string;
  coverImage: string;
  rating: string | number;
  dateRead: string;
  link?: string; // Make link optional as it might be null/undefined
}
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
      const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
      return data;
    }
  } catch (error) {
    console.error('Error reading cache:', error);
  }
  return null;
}

// Helper function to write to cache
function writeToCache(data: any): void {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

// Helper function to extract books from a page
async function extractBooksFromPage(page: any): Promise<any[]> {
  console.log('Extracting books from page...');
  
  // First, wait for the books to be visible
  try {
    await page.waitForSelector('tr.bookalike', { timeout: 10000 });
  } catch (error) {
    console.error('Could not find any books on the page');
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-no-books.png' });
    return [];
  }
  
  // Get the page HTML for debugging
  const pageContent = await page.content();
  console.log('Page content length:', pageContent.length);
  
  // Save HTML for inspection (Node.js context)
  writeFileSync('debug-page.html', pageContent);
  
  return page.evaluate(() => {
    console.log('Starting book extraction in browser context...');
    const books: Book[] = [];
    const bookIds = new Set(); // Track book IDs to prevent duplicates
    
    // More specific selector for Goodreads book rows
    const rows = Array.from(document.querySelectorAll('tr.bookalike'));
    console.log(`Found ${rows.length} potential book rows`);
    
    rows.forEach((row, index) => {
      try {
        console.log(`Processing row ${index + 1}/${rows.length}`);
        
        // Get the book ID from the row's ID or data attribute
        const rowId = row.id || '';
        const bookIdMatch = rowId.match(/book_?(\d+)/i);
        const bookId = bookIdMatch ? bookIdMatch[1] : null;
        
        // Skip if we've already processed this book
        if (bookId && bookIds.has(bookId)) {
          console.log(`Skipping duplicate book ID: ${bookId}`);
          return;
        }
        
        // Try different selectors for each field with more specific targeting
        const titleElement = row.querySelector('.field.title a[href*="/book/show/"]');
        const authorElement = row.querySelector('.field.author a[href*="/author/"]');
        const coverElement = row.querySelector('img.bookCover[src*="nophoto"]') || 
                            row.querySelector('img.bookCover[src*="goodreads"]');
        const ratingElement = row.querySelector('.staticStars[title]') || 
                             row.querySelector('.staticStars') ||
                             row.querySelector('[aria-label*="rating"]');
        const dateElement = row.querySelector('.date_read_value') || 
                           row.querySelector('.date_read') ||
                           row.querySelector('[title*="read"]');
        
        // Only process if we have a valid title and author
        const title = titleElement?.textContent?.trim();
        const author = authorElement?.textContent?.trim();
        
        if (title && title !== 'Unknown Title' && author) {
          // Clean up rating
          let rating = 'Not rated';
          if (ratingElement) {
            rating = ratingElement.getAttribute('title')?.replace('it was ', '') || 
                    ratingElement.textContent?.trim() || 
                    'Not rated';
            // Convert star ratings like 'it was amazing' to numbers
            if (typeof rating === 'string') {
              const ratingMap: Record<string, string> = {
                'it was amazing': '5',
                'really liked it': '4',
                'liked it': '3',
                'it was ok': '2',
                'did not like it': '1'
              };
              rating = ratingMap[rating.toLowerCase()] || rating;
            }
          }
          
          // Clean up date
          let dateRead = dateElement?.textContent?.trim() || 
                        dateElement?.getAttribute('title') || 
                        'Not specified';
          dateRead = dateRead.replace(/^date read\s*[\n\s]*/i, '').trim();
          
          // Get cover image, prefer larger version if available
          let coverImage = '';
          if (coverElement) {
            const src = coverElement.getAttribute('src') || '';
            coverImage = src.replace(/\.[^.]*_SX\d+_/, '_SX200_'); // Get medium size
          }
          
          const bookData = {
            title: title,
            author: author,
            coverImage: coverImage,
            rating: rating,
            dateRead: dateRead,
            link: (() => {
              const href = titleElement?.getAttribute('href');
              if (!href) return undefined;
              return href.startsWith('http') ? href : `https://www.goodreads.com${href}`;
            })()
          };
          
          console.log('Extracted book:', JSON.stringify(bookData, null, 2));
          
          if (bookId) bookIds.add(bookId);
          books.push(bookData);
        } else {
          console.log('Skipping row - missing title or author');
          console.log('Title:', title);
          console.log('Author:', author);
        }
      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error);
      }
    });
    
    console.log(`Extracted ${books.length} books from page`);
    return books;
  });
}

// Helper function to check for next page
async function hasNextPage(page: any): Promise<boolean> {
  return page.evaluate(() => {
    const nextButton = document.querySelector('a.next_page');
    return nextButton && !nextButton.classList.contains('disabled');
  });
}

// Helper function to navigate to next page
async function goToNextPage(page: any): Promise<boolean> {
  const clicked = await page.evaluate(() => {
    const nextButton = document.querySelector('a.next_page') as HTMLAnchorElement;
    if (nextButton && !nextButton.classList.contains('disabled')) {
      nextButton.click();
      return true;
    }
    return false;
  });
  
  if (clicked) {
    await page.waitForLoadState('networkidle');
    return true;
  }
  return false;
}

router.get('/read', async (req: Request, res: Response) => {
  let browser;
  
  try {
    // Add headers to prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Log request headers for debugging
    console.log('Request headers:', req.headers);
    console.log('Cache-Control header set to no-cache');
    
    // Check cache first, but respect cache-busting
    const cacheBust = req.query.bustCache === 'true';
    const cachedData = cacheBust ? null : readFromCache();
    const now = Date.now();
    
    // If we have valid cached data and not forcing refresh, return it
    if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
      console.log('Returning cached book data');
      return res.json({
        success: true,
        books: cachedData.data.books || [],
        stats: cachedData.data.stats || { totalBooks: 0, pagesProcessed: 0 },
        fromCache: true,
        cachedAt: new Date(cachedData.timestamp).toISOString(),
        cacheBusted: false
      });
    }
    
    console.log(cacheBust ? 'Cache bust requested' : 'Cache miss or expired');
    
    console.log('Cache miss or expired, scraping Goodreads...');
    
    const GOODREADS_USER_ID = process.env.GOODREADS_USER_ID;
    if (!GOODREADS_USER_ID) {
      throw new Error('GOODREADS_USER_ID environment variable is not set');
    }
    
    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // Navigate to the Goodreads shelf with a more permissive waitUntil
    const url = `https://www.goodreads.com/review/list/${GOODREADS_USER_ID}?shelf=read&per_page=100&sort=date_read`;
    console.log(`Navigating to: ${url}`);
    
    // First try with networkidle, then fall back to domcontentloaded
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle', 
        timeout: 60000 
      });
      console.log('Page loaded with networkidle');
    } catch (error) {
      console.log('Networkidle timeout, trying with domcontentloaded...');
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
      console.log('Page loaded with domcontentloaded');
    }
    
    // Wait for potential JavaScript to load
    await page.waitForTimeout(5000);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'goodreads-page.png', fullPage: true });
    console.log('Screenshot saved to goodreads-page.png');
    
    // Log page title and URL for debugging
    console.log('Page title:', await page.title());
    console.log('Current URL:', page.url());
    
    // Check if we got redirected to login
    if (page.url().includes('sign_in') || page.url().includes('login')) {
      throw new Error('Redirected to login page. Goodreads might be detecting automation.');
    }
    
    // Check if we're on a login page or got rate limited
    const pageTitle = await page.title();
    if (pageTitle.toLowerCase().includes('sign in') || 
        pageTitle.toLowerCase().includes('login') ||
        (await page.content()).includes('Access to this page has been denied')) {
      throw new Error('Access denied or login required. Goodreads might be blocking automated access.');
    }
    
    let allBooks: Book[] = [];
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      console.log(`Processing page ${pageNum}...`);
      
      // Extract books from current page
      const books = await extractBooksFromPage(page);
      allBooks = [...allBooks, ...books];
      
      console.log(`Found ${books.length} books on page ${pageNum}`);
      
      // Check if there's a next page
      hasMorePages = await hasNextPage(page);
      
      if (hasMorePages) {
        const success = await goToNextPage(page);
        if (!success) {
          console.log('Failed to navigate to next page, stopping pagination');
          hasMorePages = false;
        } else {
          pageNum++;
          // Add a small delay between pages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    console.log(`Total books found: ${allBooks.length}`);
    
    // Prepare response data
    const responseData = {
      books: allBooks,
      stats: {
        totalBooks: allBooks.length,
        pagesProcessed: pageNum
      }
    };
    
    // Write to cache for future requests
    writeToCache(responseData);
    
    const result = {
      success: true,
      ...responseData,
      fromCache: false,
      cachedAt: new Date().toISOString(),
      cacheBusted: cacheBust
    };
    
    console.log('Sending response with', result.stats.totalBooks, 'books');
    return res.json(result);
    
  } catch (error) {
    console.error('Error in /read endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch books',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // Close the browser if it was opened
    if (browser) {
      await browser.close().catch(console.error);
    }
  }
});

export default router;

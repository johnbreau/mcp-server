import { Request, Response, Router } from 'express';
// File system operations not needed with caching disabled
import dotenv from 'dotenv';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { join } from 'path';

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
        // We'll find the rating element later when processing the rating
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
            
            // Try to extract the book ID from the image URL
            const bookIdMatch = src.match(/\/(\d+)_/);
            if (bookIdMatch && bookIdMatch[1]) {
              // Use the Goodreads image proxy with the book ID
              coverImage = `https://images-na.ssl-images-amazon.com/images/P/${bookIdMatch[1]}.01._SX200_.jpg`;
            } else {
              // Fallback to the original URL with some cleaning
              coverImage = src
                .replace(/\/s[0-9]+x[0-9]+\//, '/l')
                .replace(/\.[^.]*_SX[0-9]+_/, '_SX200_')
                .replace(/_SY[0-9]+_/, '_SY200_')
                .replace(/_SX[0-9]+_/, '_SX200_')
                .replace('_SY75_', '_SY200_')
                .replace('_SY100_', '_SY200_')
                .replace('_SY150_', '_SY200_');
            }
          }
        }
        
        // Extract rating - try multiple selectors and methods
        let rating = '0';
        
        // Log the entire row HTML for debugging
        const rowHtml = row.outerHTML;
        console.log('Row HTML:', rowHtml);
        
        // Try to find the rating element using various selectors
        const ratingElement = row.querySelector('.rating .staticStars[title]') || 
                           row.querySelector('.rating .staticStars span[aria-label]') ||
                           row.querySelector('.rating .staticStars.notranslate') ||
                           row.querySelector('.rating .staticStars') ||
                           row.querySelector('.rating .staticStars span') ||
                           row.querySelector('.rating .staticStars .p10');
                           
        console.log('Rating element found:', ratingElement);
        if (ratingElement) {
          console.log('Rating element HTML:', ratingElement.outerHTML);
          console.log('Rating element classes:', ratingElement.className);
          console.log('Rating element title:', ratingElement.getAttribute('title'));
          console.log('Rating element aria-label:', ratingElement.getAttribute('aria-label'));
          console.log('Rating element text content:', ratingElement.textContent);
        }
        
        if (ratingElement) {
          // Try to get from title attribute
          const titleAttr = ratingElement.getAttribute('title');
          if (titleAttr) {
            const titleMatch = titleAttr.match(/(\d+(?:\.\d+)?)/);
            if (titleMatch) rating = titleMatch[1];
          }
          
          // Try to get from aria-label
          const ariaLabel = ratingElement.getAttribute('aria-label');
          if (ariaLabel) {
            const ariaMatch = ariaLabel.match(/(\d+(?:\.\d+)?)/);
            if (ariaMatch) rating = ariaMatch[1];
          }
          
          // Try to get from class name (e.g., p10 for 5 stars, p8 for 4 stars, etc.)
          for (let i = 0; i < ratingElement.classList.length; i++) {
            const className = ratingElement.classList[i];
            if (className.startsWith('p')) {
              const ratingValue = parseFloat(className.substring(1)) / 2;
              if (!isNaN(ratingValue)) {
                rating = ratingValue.toString();
                break;
              }
            }
          }
          
          // Try to get from inner text as last resort
          if (rating === '0') {
            const textContent = ratingElement.textContent?.trim();
            if (textContent) {
              const textMatch = textContent.match(/(\d+(?:\.\d+)?)/);
              if (textMatch) rating = textMatch[1];
            }
          }
        }
        
        // If still no rating, try to find any star rating in the row
        if (rating === '0') {
          const starElements = row.querySelectorAll('.staticStar.p10, .staticStar.p8, .staticStar.p6, .staticStar.p4, .staticStar.p2');
          if (starElements.length > 0) {
            rating = (starElements.length * 2).toString();
          }
        }
        
        books.push({
          title: titleElement.textContent?.trim() || 'Unknown Title',
          author: authorElement.textContent?.trim() || 'Unknown Author',
          coverImage,
          rating,
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

// Launch browser with retry
async function launchBrowserWithRetry(maxRetries = 3): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  // These will be properly initialized in the try block
  let browser: Browser | null = null;
  // These are only used for cleanup in case of errors
  const cleanup: { browser?: Browser; context?: BrowserContext; page?: Page } = {};
  let lastError: Error | null = null;
  
  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Launching browser (attempt ${attempt}/${maxRetries})...`);
        browser = await chromium.launch({
          headless: true, // Run in headless mode (no browser window)
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--headless=new' // Newer headless mode
          ]
        });
        
        const context = await browser.newContext({
          viewport: { width: 1366, height: 768 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          locale: 'en-US',
          timezoneId: 'America/Chicago'
        });
        
        // Block images to speed up loading
        await context.route('**/*.{png,jpg,jpeg,webp,svg}', route => route.abort());
        
        const page = await context.newPage();
        
        // Set extra headers to appear more like a regular browser
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        console.log('Browser launched successfully');
        // Store resources for cleanup
        // Store the browser for cleanup
        cleanup.browser = browser;
        
        // Create a new context and page for this browser instance
        const newContext = await browser.newContext({
          viewport: { width: 1366, height: 768 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          locale: 'en-US',
          timezoneId: 'America/Chicago'
        });
        
        // Block images to speed up loading
        await newContext.route('**/*.{png,jpg,jpeg,webp,svg}', route => route.abort());
        
        const newPage = await newContext.newPage();
        
        // Set extra headers to appear more like a regular browser
        await newPage.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        // Store for cleanup
        cleanup.context = newContext;
        cleanup.page = newPage;
        
        // Return the browser, context, and page
        return { 
          browser, 
          context: newContext, 
          page: newPage
        };
      } catch (error) {
        const typedError = error as Error;
        lastError = typedError;
        console.error(`Browser launch attempt ${attempt} failed:`, typedError);
        
        // Close browser if it was created but something else failed
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.error('Error closing browser:', closeError);
          }
          browser = null;
        }
        
        await delay(2000); // Wait before retry
      }
    }
    
    throw lastError || new Error('Failed to launch browser after multiple attempts');
  } catch (error) {
    // Ensure resources are properly cleaned up
    if (cleanup.context) {
      try {
        await cleanup.context.close();
      } catch (closeError) {
        console.error('Error closing browser context during cleanup:', closeError);
      }
    } else if (cleanup.browser) {
      try {
        await cleanup.browser.close();
      } catch (closeError) {
        console.error('Error closing browser during cleanup:', closeError);
      }
    }
    throw error;
  }
}

// Process a page and extract books
async function processPage(page: Page, pageNum: number): Promise<{ books: Book[]; hasNext: boolean }> {
  try {
    console.log(`\n=== Processing Page ${pageNum} ===`);
    const url = `https://www.goodreads.com/review/list/${process.env.GOODREADS_USER_ID}?shelf=read&per_page=100&page=${pageNum}`;
    console.log(`Navigating to: ${url}`);
    
    // Use a more reliable navigation approach
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000,
      referer: 'https://www.goodreads.com/',
    });
    
    // Check if the response is valid
    if (!response) {
      throw new Error('No response from page load');
    }
    
    console.log(`Status: ${response.status()} ${response.statusText()}`);
    
    // Wait for the content to be fully loaded
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Check if we're on a login page or error page
    const pageTitle = (await page.title()).toLowerCase();
    console.log(`Page title: ${pageTitle}`);
    
    if (pageTitle.includes('sign in') || pageTitle.includes('access denied') || pageTitle.includes('oops')) {
      console.error('Redirected to login, access denied, or error page');
      // Take a screenshot for debugging
      await page.screenshot({ path: `error-page-${Date.now()}.png` });
      return { books: [], hasNext: false };
    }
    
    // Wait for book elements to be present
    await page.waitForSelector('tr[itemtype*="Book"], tr.shelfRow, .bookalike', { timeout: 10000 })
      .catch(() => console.log('No book elements found immediately, continuing anyway...'));
    
    // Extract books with retry
    const books = await extractBooksWithRetry(page);
    
    if (books.length === 0) {
      console.log('No books found on page, taking screenshot...');
      await page.screenshot({ path: `no-books-page-${pageNum}-${Date.now()}.png` });
    }
    
    // Check for next page
    const hasNext = await hasNextPage(page);
    console.log(`Has next page: ${hasNext}`);
    
    return { books, hasNext };
  } catch (error) {
    console.error(`Error processing page ${pageNum}:`, error);
    // Take a screenshot on error
    try {
      await page.screenshot({ path: `error-page-${pageNum}-${Date.now()}.png` });
    } catch (screenshotError) {
      console.error('Failed to take screenshot:', screenshotError);
    }
    return { books: [], hasNext: false };
  }
}

// Enable CORS for all routes
router.use((_req: Request, res: Response, next: () => void) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control, Pragma, Expires');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (_req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Main route handler
router.get('/read', async (_req: Request, res: Response) => {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    console.log('Caching is disabled - fetching fresh data');
    
    // Launch browser with retry
    const browserResult = await launchBrowserWithRetry();
    browser = browserResult.browser;
    context = browserResult.context;
    page = browserResult.page;
    
    if (!browser || !page) {
      throw new Error('Failed to initialize browser or page');
    }
    
    const allBooks: Book[] = [];
    let pageNum = 1;
    const maxPages = 24; // Increased to ensure we get all books (24 pages × 20 books = 480 total)
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    
    while (pageNum <= maxPages && consecutiveErrors < maxConsecutiveErrors) {
      try {
        console.log(`\nProcessing page ${pageNum}...`);
        
        // Create a new page for each request to avoid state issues
        if (page) {
          await page.close().catch(console.error);
        }
        
        if (!context) {
          throw new Error('Browser context is not available');
        }
        
        page = await context.newPage();
        
        const { books, hasNext } = await processPage(page, pageNum);
        
        if (books.length > 0) {
          allBooks.push(...books);
          console.log(`Added ${books.length} books from page ${pageNum}, total: ${allBooks.length}`);
          consecutiveErrors = 0; // Reset error counter on success
        } else {
          console.log(`No books found on page ${pageNum}`);
          consecutiveErrors++;
        }
        
        if (!hasNext) {
          console.log('No more pages to process');
          break;
        }
        
        pageNum++;
        
        // Add a random delay between pages to appear more human-like
        const delayMs = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
        console.log(`Waiting ${delayMs}ms before next page...`);
        await delay(delayMs);
        
      } catch (error) {
        console.error(`Error processing page ${pageNum}:`, error);
        consecutiveErrors++;
        
        // Take a screenshot of the error
        try {
          if (page) {
            await page.screenshot({ path: `error-page-${pageNum}-${Date.now()}.png` });
          }
        } catch (screenshotError) {
          console.error('Failed to take screenshot:', screenshotError);
        }
        
        // If we've had too many consecutive errors, give up
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error(`Too many consecutive errors (${consecutiveErrors}), stopping...`);
          break;
        }
        
        // Wait before retrying
        const retryDelay = 3000 * consecutiveErrors; // Exponential backoff
        console.log(`Retrying in ${retryDelay}ms...`);
        await delay(retryDelay);
      }
    }
    
    // Prepare the response
    const responseData = {
      success: true,
      books: allBooks,
      stats: {
        totalBooks: allBooks.length,
        pagesProcessed: pageNum - 1,
        completed: consecutiveErrors < maxConsecutiveErrors && pageNum <= maxPages
      },
      fromCache: false,
      cachedAt: new Date().toISOString()
    };
    
    // Send response
    console.log(`Sending response with ${allBooks.length} books`);
    return res.json(responseData);
    
  } catch (error) {
    console.error('Error in /read endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    });
    
  } finally {
    // Clean up with proper error handling
    const cleanup = async () => {
      try {
        if (page) await page.close().catch(console.error);
        if (context) await context.close().catch(console.error);
        if (browser) await browser.close().catch(console.error);
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    };
    
    await cleanup();
  }
});

export default router;

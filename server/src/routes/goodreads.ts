import { Router, Request, Response } from 'express';
import { chromium, Page, Browser, Response as PlaywrightResponse } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Use a relative path from the project root
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'goodreads_books.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

interface CachedData {
  timestamp: number;
  data: {
    books: Book[];
    stats: {
      totalBooks: number;
      pagesProcessed: number;
    };
  };
}

const router = Router();

// Helper function to read from cache
function readFromCache(): CachedData | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const fileContent = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Error reading from cache:', error);
  }
  return null;
}

// Helper function to write to cache
function writeToCache(data: {
  books: Book[];
  stats: {
    totalBooks: number;
    pagesProcessed: number;
  };
}): void {
  try {
    const cacheData: CachedData = {
      timestamp: Date.now(),
      data: data
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

interface Book {
  title: string;
  author: string;
  coverImage: string;
  rating: number;
  dateRead: string;
  link: string;
}

// Helper function to extract books from a single page
async function extractBooksFromPage(page: any, pageNum: number) {
  console.log(`[Page ${pageNum}] Extracting book data...`);
  
  try {
    // First, wait for the main content to be visible
    await page.waitForSelector('#booksBody', { 
      timeout: 30000,
      state: 'visible'
    });
    
    // Wait for books to be loaded
    await page.waitForSelector('.bookalike', { 
      timeout: 30000,
      state: 'attached'
    });
    
    // Scroll to load lazy-loaded content
    console.log(`[Page ${pageNum}] Scrolling to load content...`);
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 500; // Increased scroll distance for faster scrolling
        const scrollDelay = 200; // Slightly longer delay between scrolls
        
        const scrollStep = () => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            resolve(true);
          } else {
            setTimeout(scrollStep, scrollDelay);
          }
        };
        
        scrollStep();
      });
    });
    
    // Wait for any lazy loading
    console.log(`[Page ${pageNum}] Waiting for content to load...`);
    await page.waitForTimeout(3000);
    
    // Extract books with more resilient selectors
    console.log(`[Page ${pageNum}] Extracting book data...`);
    const books = await page.$$eval('.bookalike', (rows: Element[]) => {
      return rows.map((row: Element) => {
        try {
          // Try multiple selector variations for each field
          const titleElement = row.querySelector('.field.title a, .title a, .titleValue a');
          const authorElement = row.querySelector('.field.author a, .authorName, .author a');
          const coverElement = row.querySelector('.field.cover img, .bookCover, .coverImage img');
          const ratingElement = row.querySelector('.field.rating .staticStars, .staticStars, .rating .stars');
          const dateElement = row.querySelector('.field.date_read .date_read_value, .date_read_value, .date_read .value');
          
          // Get title with fallbacks
          let title = 'Unknown Title';
          if (titleElement) {
            title = (titleElement.textContent || '').trim();
            // If title is in format "Title (Series #1)", extract just the title
            const match = title.match(/^([^(]+)/);
            if (match) title = match[1].trim();
          }
          
          // Get author with fallbacks
          let author = 'Unknown Author';
          if (authorElement) {
            author = (authorElement.textContent || '').trim();
            // Clean up author name if it has extra whitespace
            author = author.replace(/\s+/g, ' ').trim();
          }
          
          // Skip if we don't have a valid title and author
          if ((title === 'Unknown Title' || title === '') && (author === 'Unknown Author' || author === '')) {
            console.log('Skipping book - missing title and author');
            return null;
          }
          
          // Clean up cover image URL
          let coverImage = '';
          if (coverElement) {
            const src = coverElement.getAttribute('src') || '';
            // Remove size parameters from image URL for higher resolution
            coverImage = src.replace(/\._(SX|SY|AC_|UX_|CR_|PD_).*?_(\.[a-zA-Z]+)$/, '$2');
          }
          
          // Extract rating (number of filled stars)
          let rating = 0;
          if (ratingElement) {
            const classList = Array.from(ratingElement.classList);
            const starClass = classList.find(cls => cls.startsWith('p'));
            if (starClass) {
              const match = starClass.match(/p(\d+)/);
              if (match) rating = Math.round(parseInt(match[1], 10) / 20); // Convert 0-100 to 0-5
            } else {
              // Try to parse stars from class names
              for (const cls of classList) {
                if (cls.includes('star')) {
                  const match = cls.match(/(\d+)/);
                  if (match) {
                    rating = parseInt(match[1], 10);
                    break;
                  }
                }
              }
            }
          }
          
          // Clean up date
          let dateRead = 'Not specified';
          if (dateElement) {
            dateRead = (dateElement.textContent || '').trim();
            // Try to parse and reformat the date
            try {
              const date = new Date(dateRead);
              if (!isNaN(date.getTime())) {
                dateRead = date.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                });
              }
            } catch (e) {
              // Keep original date string if parsing fails
            }
          }
          
          // Get book link
          let link = '#';
          if (titleElement) {
            const href = titleElement.getAttribute('href');
            if (href) link = href;
          }
          
          return {
            title,
            author,
            coverImage,
            rating,
            dateRead,
            link: link.startsWith('http') ? link : `https://www.goodreads.com${link}`
          };
        } catch (error) {
          console.error('Error processing book row:', error);
          return null;
        }
      }).filter(Boolean); // Remove any null entries
    });
    
    console.log(`[Page ${pageNum}] Extracted ${books.length} books`);
    return books;
  } catch (error) {
    console.error(`[Page ${pageNum}] Error extracting books:`, error);
    return [];
  }
}

// Helper function to check if there's a next page
async function hasNextPage(page: any, pageNum: number): Promise<boolean> {
  try {
    const hasNext = await page.evaluate(() => {
      const nextButton = document.querySelector('a.next_page');
      const isDisabled = nextButton?.classList?.contains('disabled');
      const isVisible = nextButton && window.getComputedStyle(nextButton).display !== 'none';
      return isVisible && !isDisabled;
    });
    
    console.log(`[Page ${pageNum}] Has next page:`, hasNext);
    return hasNext;
  } catch (error) {
    console.error(`[Page ${pageNum}] Error checking for next page:`, error);
    return false;
  }
}

// Helper function to navigate to next page
async function goToNextPage(page: any, pageNum: number): Promise<boolean> {
  try {
    console.log(`[Page ${pageNum}] Attempting to navigate to next page...`);
    
    // First click the next button
    await page.evaluate(() => {
      const nextButton = document.querySelector('a.next_page');
      if (nextButton) {
        (nextButton as HTMLElement).click();
      }
    });
    
    // Wait for navigation to complete
    await page.waitForNavigation({ 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    // Wait for the books to load on the new page
    await page.waitForSelector('.bookalike', { 
      timeout: 60000,
      state: 'attached'
    });
    
    console.log(`[Page ${pageNum + 1}] Navigation successful`);
    return true;
  } catch (error) {
    console.error(`[Page ${pageNum}] Error navigating to next page:`, error);
    return false;
  }
}

router.get('/read', async (req: Request, res: Response) => {
  // Check cache first
  const cachedData = readFromCache();
  const now = Date.now();
  
  // If we have valid cached data, return it
  if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
    console.log('Returning cached book data');
    return res.json({
      success: true,
      books: cachedData.data.books,
      stats: cachedData.data.stats,
      fromCache: true,
      cachedAt: new Date(cachedData.timestamp).toISOString()
    });
  }
  
  console.log('Cache miss or expired, scraping Goodreads...');
  
  // If we get here, we need to scrape fresh data
  // Log environment variables for debugging
  console.log('Environment variables:', {
    GOODREADS_USER_ID: process.env.GOODREADS_USER_ID ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV,
    NODE_DEBUG: process.env.NODE_DEBUG
  });

  const GOODREADS_USER_ID = process.env.GOODREADS_USER_ID;

  if (!GOODREADS_USER_ID) {
    throw new Error('GOODREADS_USER_ID environment variable is not set');
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ 
    headless: true,
    timeout: 60000, // Increased timeout
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--start-maximized'
    ],
    slowMo: 50 // Add small delay between actions
  });

  try {
    console.log('Creating new browser context...');
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      bypassCSP: true,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    console.log('Creating new page...');
    const page = await context.newPage();

    // Set timeouts and other page settings
    await page.setDefaultNavigationTimeout(180000); // 3 minutes
    await page.setDefaultTimeout(120000); // 2 minutes

    // Randomize viewport size slightly to appear more human-like
    await page.setViewportSize({
      width: 1920 + Math.floor(Math.random() * 100) - 50,
      height: 1080 + Math.floor(Math.random() * 100) - 50
    });

    // Block unnecessary resources to speed up loading
    await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,eot}', (route: any) => route.abort());

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://www.goodreads.com/'
    });

    // Set user agent in the context
    await context.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    });

    const baseUrl = `https://www.goodreads.com/review/list/${GOODREADS_USER_ID}?shelf=read&per_page=100`;
    console.log('Navigating to Goodreads:', baseUrl);

    try {
      // First, try to navigate directly to the books page with a more permissive timeout
      console.log('Attempting to load books page directly...');
      const response = await page.goto(baseUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 120000,
        referer: 'https://www.goodreads.com/'
      });

      const status = response ? response.status() : 0;
      const finalUrl = response ? response.url() : '';

      console.log('Initial navigation completed. Status:', status, 'Final URL:', finalUrl);

      // Wait for the page to be fully loaded
      console.log('Waiting for page to be fully loaded...');
      try {
        await page.waitForSelector('.bookalike', { timeout: 30000 });
      } catch (e) {
        console.log('Book list not immediately available, waiting a bit longer...');
        await page.waitForTimeout(5000); // Wait 5 more seconds
      }

      // Take a screenshot for debugging
      await page.screenshot({ path: 'goodreads-page.png', fullPage: true });
      console.log('Screenshot saved to goodreads-page.png');

      // Check if we're on a login page or captcha
      const pageTitle = await page.title();
      console.log('Page title:', pageTitle);

      if (pageTitle.toLowerCase().includes('sign in') || 
          pageTitle.toLowerCase().includes('login') ||
          finalUrl.includes('amazon.com') ||
          finalUrl.includes('goodreads.com/ap/signin')) {
        throw new Error('Redirected to login page. Goodreads might be requiring authentication.');
      }

      // Check for captcha
      const captchaExists = await page.$('#captchaContainer, #captcha, .captcha, #recaptcha');
      if (captchaExists) {
        throw new Error('Captcha detected. Please try again later or use a different IP address.');
      }

      // Check for rate limiting or captcha
      if (finalUrl.includes('sorry') || status === 429 || finalUrl.includes('authwall')) {
        throw new Error('Rate limited or captcha detected. Please try again later.');
      }
    } catch (error: unknown) {
      console.error('Error during navigation:', error);

      // Take a screenshot on error
      await page.screenshot({ path: 'goodreads-error.png', fullPage: true });
      console.log('Error screenshot saved to goodreads-error.png');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to load Goodreads: ${errorMessage}`);
    }

    // Check for rate limiting or captcha in the response
    const response = await page.goto(baseUrl, { 
      waitUntil: 'networkidle',
      timeout: 120000,
      referer: 'https://www.goodreads.com/'
    });
    
    const status = response ? response.status() : 0;
    const finalUrl = response ? response.url() : '';
    
    if (finalUrl.includes('sorry') || status === 429 || finalUrl.includes('authwall')) {
      const pageContent = await page.content();
      console.error('Rate limited or captcha detected. Page content length:', pageContent.length);
      throw new Error('Rate limited or captcha detected. Please try again later.');
    }
    
    // Extract books from all pages
    let allBooks: Book[] = [];
    let pageNum = 1;
    const maxPages = 100; // Increased max pages to ensure we get all books
    let retryCount = 0;
    const maxRetries = 5;
    let consecutiveEmptyPages = 0;
    const maxConsecutiveEmptyPages = 2;
    
    while (pageNum <= maxPages) {
      console.log(`\n=== Processing Page ${pageNum} ===`);
      
      try {
        // Extract books from current page
        const pageBooks = await extractBooksFromPage(page, pageNum);
        
        // Check if we got books from this page
        if (pageBooks.length === 0) {
          console.log(`[Page ${pageNum}] No books found on this page`);
          consecutiveEmptyPages++;
          
          if (consecutiveEmptyPages >= maxConsecutiveEmptyPages) {
            console.log(`[Page ${pageNum}] Reached maximum consecutive empty pages, stopping`);
            break;
          }
          
          retryCount++;
          if (retryCount >= maxRetries) {
            console.log(`[Page ${pageNum}] Max retries reached, stopping pagination`);
            break;
          }
          
          // Wait a bit longer and try again
          const retryDelay = 5000 * retryCount;
          console.log(`[Page ${pageNum}] Retrying in ${retryDelay/1000} seconds (attempt ${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // Reset counters on successful page load
        consecutiveEmptyPages = 0;
        retryCount = 0;
        
        // Add books to our collection
        allBooks = [...allBooks, ...pageBooks];
        
        console.log(`[Page ${pageNum}] Found ${pageBooks.length} books (Total: ${allBooks.length})`);
        
        // Check if there's a next page
        const hasNext = await hasNextPage(page, pageNum);
        if (!hasNext) {
          console.log(`[Page ${pageNum}] No more pages to process`);
          break;
        }
        
        // Go to next page
        const success = await goToNextPage(page, pageNum);
        if (!success) {
          console.log(`[Page ${pageNum}] Failed to navigate to next page`);
          retryCount++;
          
          if (retryCount >= maxRetries) {
            console.log(`[Page ${pageNum}] Max navigation retries reached, stopping`);
            break;
          }
          
          // Try reloading the current page
          console.log(`[Page ${pageNum}] Reloading current page...`);
          await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
          continue;
        }
        
        pageNum++;
        
        // Add a random delay between pages to appear more human-like
        const delay = Math.floor(Math.random() * 5000) + 2000; // 2-7 seconds
        console.log(`Waiting ${delay/1000} seconds before next page...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.error(`[Page ${pageNum}] Error:`, error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.log(`[Page ${pageNum}] Max retries reached, stopping pagination`);
          break;
        }
        
        console.log(`[Page ${pageNum}] Retrying in 10 seconds (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    console.log(`Total books found: ${allBooks.length}`);
    
    // Remove duplicates and filter out invalid entries
    const uniqueBooks = Array.from(
      new Map(
        allBooks
          .filter(book => {
            // Filter out invalid entries
            const isValid = book && 
                         book.title && 
                         book.title !== 'Unknown Title' && 
                         book.author && 
                         book.author !== 'Unknown Author';
            
            if (!isValid) {
              console.log('Filtering out invalid book:', JSON.stringify(book, null, 2));
              return false;
            }
            return true;
          })
          .map(book => {
            // Create a unique key for each book
            const key = `${book.title.toLowerCase().trim()}-${book.author.toLowerCase().trim()}`;
            return [key, book];
          })
      ).values()
    ) as Book[];
    
    console.log(`\n=== Scraping Complete ===`);
    console.log(`Total pages processed: ${pageNum}`);
    console.log(`Total books found: ${allBooks.length}`);
    console.log(`Unique books after deduplication: ${uniqueBooks.length}`);
    
    if (uniqueBooks.length === 0) {
      const errorMsg = 'No valid books found after processing. Please check the logs for more details.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Log a sample of the books for verification
    console.log('\nSample of books found:');
    uniqueBooks.slice(0, 5).forEach((book, i) => {
      console.log(`${i + 1}. ${book.title} by ${book.author} (${book.dateRead})`);
    });
    
    await browser.close();
    // Prepare the response data
    const responseData = {
      books: uniqueBooks,
      stats: {
        totalBooks: uniqueBooks.length,
        pagesProcessed: pageNum
      }
    };
    
    // Update the cache
    writeToCache(responseData);
    console.log('Updated cache with fresh data');
    
    // Return the results
    res.json({
      success: true,
      ...responseData,
      fromCache: false,
      cachedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during page processing:', error);
    const errorResponse = {
      success: false,
      error: 'Failed to fetch books',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
    
    console.error('Error response:', JSON.stringify(errorResponse, null, 2));
    res.status(500).json(errorResponse);
  } finally {
    // Make sure to close the browser to free up resources
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (err) {
        console.error('Error closing browser:', err);
      }
    }
  }
});

export default router;

import { Router } from 'express';
import { chromium } from 'playwright';

const router = Router();

interface Book {
  title: string;
  author: string;
  coverImage: string;
  rating: number;
  dateRead: string;
  link: string;
}

router.get('/books/read', async (req, res) => {
  let browser;
  try {
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
    browser = await chromium.launch({ 
      headless: true,
      timeout: 30000, // 30 seconds timeout for browser launch
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true
    });
    
    const page = await context.newPage();
    await page.setDefaultNavigationTimeout(120000); // 120 seconds for navigation
    await page.setDefaultTimeout(120000); // 120 seconds for other operations
    
    const url = `https://www.goodreads.com/review/list/${GOODREADS_USER_ID}?shelf=read&per_page=100`;
    console.log('Navigating to Goodreads:', url);
    
    try {
      console.log('Making request to:', url);
      // Set extra HTTP headers
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      
      // Make the request
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 120000,
        referer: 'https://www.goodreads.com/'
      });
      
      const status = response?.status();
      const finalUrl = response?.url();
      console.log('Navigation completed. Status:', status, 'Final URL:', finalUrl);
      
      // Check if we got rate limited or shown a captcha
      if (finalUrl?.includes('sorry') || status === 429 || finalUrl?.includes('authwall')) {
        const pageContent = await page.content();
        console.error('Rate limited or captcha detected. Page content length:', pageContent.length);
        throw new Error('Goodreads is rate limiting or showing a captcha. Please try again later.');
      }
      
      console.log('Waiting for books to load...');
      try {
        await page.waitForSelector('.bookalike', { 
          timeout: 30000,
          state: 'attached'
        });
        console.log('Book elements found on page');
      } catch (err) {
        const pageContent = await page.content();
        console.error('Error waiting for books. Page content length:', pageContent.length);
        if (pageContent.includes('Rate limit exceeded')) {
          throw new Error('Goodreads rate limit exceeded. Please try again later.');
        }
        throw err;
      }
    } catch (error) {
      console.error('Navigation error:', error);
      const pageContent = await page.content();
      console.error('Page content:', pageContent.substring(0, 1000)); // Log first 1000 chars of page
      throw error;
    }
    
    console.log('Extracting book data...');
    // Take a screenshot for debugging
    await page.screenshot({ path: 'goodreads-page.png' });
    console.log('Screenshot saved to goodreads-page.png');
    
    const books = await page.$$eval('.bookalike', (rows) => {
      return rows.map(row => {
        const titleElement = row.querySelector('.field.title a');
        const authorElement = row.querySelector('.field.author a');
        const coverElement = row.querySelector('.field.cover img');
        const ratingElement = row.querySelector('.field.rating .staticStars');
        const dateElement = row.querySelector('.field.date_read .date_read_value');
        
        return {
          title: titleElement?.textContent?.trim() || 'Unknown Title',
          author: authorElement?.textContent?.trim() || 'Unknown Author',
          coverImage: coverElement?.getAttribute('src') || '',
          rating: ratingElement ? ratingElement.classList.length - 1 : 0,
          dateRead: dateElement?.textContent?.trim() || 'Not specified',
          link: titleElement?.getAttribute('href') || '#'
        };
      });
    });
    
    console.log(`Found ${books.length} books`);
    await browser.close();
    
    res.json({ success: true, data: books });
  } catch (error) {
    console.error('Error scraping Goodreads:', error);
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

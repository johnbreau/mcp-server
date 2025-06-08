# Goodreads Integration

This feature allows you to display your Goodreads "Read" bookshelf on your personal dashboard.

## Setup Instructions

1. **Find Your Goodreads User ID**
   - Log in to your Goodreads account
   - Go to your profile page
   - In the URL, you'll see a number like `12345678` in `https://www.goodreads.com/user/show/12345678-username`
   - This is your Goodreads User ID

2. **Set Environment Variable**
   Create a `.env` file in the root of your project and add:
   ```
   GOODREADS_USER_ID=your_user_id_here
   PORT=3001
   ```

3. **Install Dependencies**
   ```bash
   npm install
   cd server
   npm install
   ```

4. **Start the Server**
   In one terminal, start the backend server:
   ```bash
   cd server
   npx ts-node src/index.ts
   ```

   In another terminal, start the frontend:
   ```bash
   npm run dev
   ```

5. **Access the Books Page**
   - Open your browser and go to `http://localhost:3000/books`
   - You should see your Goodreads "Read" bookshelf displayed

## How It Works

1. The application uses Playwright to scrape your public Goodreads profile
2. It extracts book information including:
   - Title
   - Author
   - Cover image
   - Your rating
   - Date read
3. The data is then displayed in a responsive grid layout

## Troubleshooting

- **No Books Showing**: Make sure you have books in your "Read" shelf on Goodreads
- **Slow Loading**: The first load might be slow as it scrapes Goodreads
- **Errors**: Check the browser console and server logs for any error messages

## Security Notes

- Your Goodreads user ID is only used to fetch your public profile
- No authentication is required as we're only accessing public data
- The data is not stored permanently and is fetched fresh on each page load

## Future Improvements

- Add caching to improve performance
- Implement pagination for large bookshelves
- Add search and filter functionality
- Allow sorting by different criteria (date read, rating, etc.)

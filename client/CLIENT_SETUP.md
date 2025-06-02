# Client Setup Guide

## Environment Variables

Create a `.env` file in the client directory with the following variables:

```env
# Base URL for the API (defaults to /api if not set)
VITE_API_BASE_URL=http://localhost:3000

# Set to 'true' to enable debug logging
VITE_DEBUG=true
```

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint

## Development

The client is set up with:
- React 18 with TypeScript
- Vite for fast development
- Mantine UI components
- React Query for data fetching
- React Router for navigation
- Axios for HTTP requests

## API Client

The API client is located in `src/api/obsidian.ts` and provides methods for:
- Searching notes
- Listing notes
- Getting note content
- Semantic search
- Note summarization
- Question answering

## Styling

Uses Mantine for styling with a custom theme. The theme configuration is in `src/theme/theme.ts`.

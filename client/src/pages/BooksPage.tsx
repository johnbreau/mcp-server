import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Container, 
  Title, 
  Text, 
  Group, 
  Stack, 
  TextInput, 
  Select, 
  Box, 
  LoadingOverlay, 
  Button,
  Paper,
  Pagination,
  Rating,
  Anchor,
  Flex,
  Alert,
  Badge
} from '@mantine/core';
import { 
  IconBook, 
  IconRefresh, 
  IconSearch, 
  IconExternalLink,
  IconChevronLeft,
  IconChevronRight
} from '@tabler/icons-react';

interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  rating: number;
  dateRead: string;
  link: string;
}

interface ApiResponse {
  success: boolean;
  books: Book[];
  stats: {
    totalBooks: number;
    pagesProcessed: number;
  };
  totalBooks: number;
  pagesProcessed: number;
  fromCache?: boolean;
  cachedAt?: string;
  error?: string;
}

export default function BooksPage() {
  // Constants
  const ITEMS_PER_PAGE = 10;
  
  // State management
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'title' | 'author' | 'rating' | 'date'>('date');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Process book cover images to handle Goodreads hotlinking restrictions
  const processBookCover = (url: string) => {
    if (!url) return '';
    
    // If the URL is already a full URL, return it as is
    if (url.startsWith('http')) {
      return url;
    }
    
    // Handle relative URLs
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    
    // Handle book IDs (e.g., 12345_SX200_.jpg)
    const bookIdMatch = url.match(/(\d+)[^\d]*\./);
    if (bookIdMatch) {
      const bookId = bookIdMatch[1];
      return `https://covers.openlibrary.org/b/id/${bookId}-M.jpg?default=false`;
    }
    
    return url;
  };
  
  // Styles for pagination
  const paginationStyles = {
    control: {
      '&[data-active]': {
        backgroundColor: 'var(--mantine-color-blue-6)',
        color: 'var(--mantine-color-white)',
        '&:hover': {
          backgroundColor: 'var(--mantine-color-blue-7)',
        },
      },
      '&:not([data-disabled]):hover': {
        backgroundColor: 'var(--mantine-color-gray-1)',
      },
    },
  } as const;
  
  // Function to fetch books with caching for 1 week
  const fetchBooks = async (): Promise<ApiResponse> => {
    const url = new URL('http://localhost:3000/api/books/read');
    
    console.log('Fetching books from:', url.toString());
    const response = await fetch(url.toString());
    const data: ApiResponse = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load books');
    }
    
    return data;
  };

  const { 
    data: booksData, 
    isLoading, 
    error: fetchError, 
    refetch 
  } = useQuery<ApiResponse, Error>({
    queryKey: ['books'],
    queryFn: fetchBooks,
    gcTime: 7 * 24 * 60 * 60 * 1000, // 1 week cache
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    retry: 2,
  });
  
  // Use the books from the API response or default to an empty array
  const books = useMemo(() => booksData?.books || [], [booksData]);

  // Update error state
  useEffect(() => {
    if (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'An unknown error occurred');
    } else {
      setError(null);
    }
  }, [fetchError]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  
  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  // Toggle sort order is not used in the current implementation
  // const toggleSortOrder = useCallback(() => {
  //   setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  // }, []);

  // Handle sort option change
  const handleSortChange = useCallback((value: string | null) => {
    if (value) {
      setSortOption(value as 'title' | 'author' | 'rating' | 'date');
      setCurrentPage(1);
    }
  }, []);

  // Filter, sort and paginate books based on search query and sort options
  const { processedBooks, totalPages } = useMemo(() => {
    // Filter books by search query
    const filtered = books.filter((book: Book) => 
      book.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Sort books
    const sorted = [...filtered].sort((a: Book, b: Book) => {
      if (sortOption === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      } else if (sortOption === 'author') {
        return (a.author || '').localeCompare(b.author || '');
      } else if (sortOption === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      } else if (sortOption === 'date') {
        return new Date(b.dateRead || 0).getTime() - new Date(a.dateRead || 0).getTime();
      }
      return 0;
    });
    
    // Apply sort order
    if (sortOrder === 'asc' && sortOption !== 'rating') {
      sorted.reverse();
    }
    
    // Calculate total pages
    const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
    
    // Apply pagination
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    
    return { processedBooks: paginated, totalPages };
  }, [books, searchQuery, sortOption, currentPage, sortOrder]);

  if (isLoading && !books.length) {
    return (
      <Container size="lg" py="xl" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingOverlay visible={isLoading} />
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconBook size={32} />
            <Title order={1}>My Read Books</Title>
            <Badge color="blue" variant="filled" size="lg">
              {processedBooks.length} books
            </Badge>
          </Group>
          <Button 
            leftSection={<IconRefresh size={16} />} 
            onClick={handleRefresh}
            loading={isLoading}
            variant="outline"
          >
            Refresh
          </Button>
        </Group>
        
        <Group gap="md" wrap="nowrap" align="flex-end">
          <TextInput
            placeholder="Search by title or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1, maxWidth: 400 }}
            disabled={isLoading}
          />
          
          <Select
            label="Sort by"
            value={sortOption}
            onChange={(value) => handleSortChange(value)}
            data={[
              { value: 'date', label: 'Date Read' },
              { value: 'title', label: 'Title' },
              { value: 'author', label: 'Author' },
              { value: 'rating', label: 'Rating' },
            ]}
            style={{ width: 150 }}
            disabled={isLoading}
          />
          
          <Select
            label="Order"
            value={sortOrder}
            onChange={(value) => {
              if (value === 'asc' || value === 'desc') {
                setSortOrder(value);
              }
            }}
            data={[
              { value: 'desc', label: 'Descending' },
              { value: 'asc', label: 'Ascending' },
            ]}
            style={{ width: 140 }}
            disabled={isLoading}
          />
        </Group>
        
        <Text size="sm" c="dimmed">
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, processedBooks.length)} of {processedBooks.length} books
        </Text>
      </Stack>

      {error && (
        <Alert 
          title="Error loading books" 
          color="red"
          mb="xl"
        >
          {error}
        </Alert>
      )}

      {!isLoading && processedBooks.length === 0 ? (
        <Box style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          textAlign: 'center',
        }}>
          <IconBook size={48} stroke={1.5} style={{ marginBottom: 16 }} />
          <Title order={3} mb="md">No books found</Title>
          <Text c="dimmed" mb="lg">
            We couldn't find any books in your Goodreads "Read" shelf.
          </Text>
          <Button 
            leftSection={<IconRefresh size={16} />} 
            onClick={handleRefresh}
            loading={isLoading}
          >
            Refresh Data
          </Button>
        </Box>
      ) : (
        <Stack gap="md" mt="md">
          {processedBooks.map((book: Book, index: number) => (
            <Paper 
              key={index}
              withBorder 
              p="md" 
              radius="md"
              component="div"
              style={{
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateX(5px)',
                },
              }}
            >
              <Flex gap="lg" align="flex-start">
                <Box 
                  style={{
                    flex: '0 0 80px',
                    width: '80px',
                    height: '120px',
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '70px',
                    height: '110px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--mantine-color-gray-1)',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={processBookCover(book.coverImage)}
                      alt={`Cover of ${book.title}`}
                      onError={(e) => {
                        // Fallback to a placeholder if the image fails to load
                        e.currentTarget.src = 'https://placehold.co/70x110?text=No+Cover';
                      }}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                </Box>
                
                <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <div>
                      <Text fw={600} size="lg" lineClamp={2}>
                        {book.title}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {book.author}
                      </Text>
                    </div>
                    <Group gap="xs">
                      {(() => {
                        try {
                          // Get the raw rating value
                          const rawRating = typeof book.rating === 'number' 
                            ? book.rating 
                            : parseFloat(book.rating as string) || 0;
                          
                          // Convert from 0-10 scale to 0-5 scale for display
                          const displayRating = rawRating / 2;
                          
                          // Handle unrated books
                          if (rawRating === 0) {
                            return <Text size="sm" c="dimmed">Not rated</Text>;
                          }
                          
                          return (
                            <Group gap="xs" align="center">
                              <Rating 
                                value={displayRating} 
                                fractions={2} 
                                readOnly 
                                size="sm"
                              />
                              <Text size="sm" fw={500}>
                                {displayRating.toFixed(1)}
                              </Text>
                            </Group>
                          );
                        } catch (error) {
                          console.error('Error displaying rating:', error, 'for book:', book.title);
                          return (
                            <Text size="sm" c="dimmed">
                              Rating unavailable
                            </Text>
                          );
                        }
                      })()}
                    </Group>
                  </Group>
                  
                  <Text size="sm" c="dimmed">
                    {(() => {
                      if (!book.dateRead || book.dateRead === 'Not specified') {
                        return 'Date not available';
                      }
                      
                      try {
                        // First try to parse as a date string
                        const date = new Date(book.dateRead);
                        if (!isNaN(date.getTime())) {
                          return `Read on ${date.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}`;
                        }
                        
                        // If that fails, try to extract a date from the string
                        const dateMatch = book.dateRead.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/i);
                        if (dateMatch) {
                          return `Read on ${dateMatch[0]}`;
                        }
                        
                        // If we have any date-like string, return it as-is
                        return `Read: ${book.dateRead}`;
                        
                      } catch (error) {
                        console.error('Error formatting date:', error, 'for date:', book.dateRead);
                        return `Read: ${book.dateRead}`;
                      }
                    })()}
                  </Text>
                  
                  <Group gap="xs" mt="auto" justify="space-between">
                    <Badge variant="light">
                      {book.rating >= 4 ? 'Loved it' : book.rating >= 3 ? 'Liked it' : 'Read it'}
                    </Badge>
                    <Anchor 
                      href={`https://goodreads.com${book.link}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      size="sm"
                    >
                      <Group gap={4}>
                        View on Goodreads
                        <IconExternalLink size={14} />
                      </Group>
                    </Anchor>
                  </Group>
                </Stack>
              </Flex>
            </Paper>
          ))}
          
          {totalPages > 1 && (
            <Box 
              mt="xl" 
              mb="xl"
              style={{ 
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                padding: '20px 0 40px 0' // Add more bottom padding
              }}
            >
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={handlePageChange}
                siblings={1}
                boundaries={1}
                withEdges
                nextIcon={IconChevronRight}
                previousIcon={IconChevronLeft}
                getItemProps={(page) => ({
                  component: 'button',
                  style: { 
                    border: 'none', 
                    background: 'transparent',
                    padding: '8px 12px',
                    borderRadius: '4px',
                  },
                  'data-active': page === currentPage,
                })}
                styles={paginationStyles}
              />
            </Box>
          )}
        </Stack>
      )}
    </Container>
  );
}

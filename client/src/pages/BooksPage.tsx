import { useEffect, useState } from 'react';
import { 
  Container, 
  Title, 
  Text, 
  Group, 
  Image, 
  Rating, 
  Stack, 
  LoadingOverlay,
  Button,
  Alert,
  Box,
  Badge,
  TextInput,
  useMantineTheme,
  useMantineColorScheme,
  Flex,
  Paper,
  Anchor,
  Pagination,
  Select
} from '@mantine/core';
import { IconBook, IconAlertCircle, IconRefresh, IconSearch, IconExternalLink, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

interface Book {
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
  fromCache?: boolean;
  cachedAt?: string;
  error?: string;
}

const ITEMS_PER_PAGE = 20;

export default function BooksPage() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'dateRead' | 'title' | 'author' | 'rating'>('dateRead');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activePage, setActivePage] = useState(1);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/books/read');
      const data: ApiResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load books');
      }
      
      // The API now returns { success: true, books: Book[], stats: { totalBooks, pagesProcessed } }
      const booksData = Array.isArray(data) ? data : (data.books || []);
      console.log(`Loaded ${booksData.length} books from API`, data.fromCache ? '(from cache)' : '(fresh data)');
      
      setBooks(booksData);
      setFilteredBooks(booksData);
    } catch (err) {
      console.error('Error fetching books:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort books based on search query and sort options
  useEffect(() => {
    let result = [...books];
    
    // Apply search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(book => 
        book.title.toLowerCase().includes(query) || 
        book.author.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let compareResult = 0;
      
      switch (sortBy) {
        case 'title':
          compareResult = a.title.localeCompare(b.title);
          break;
        case 'author':
          compareResult = a.author.localeCompare(b.author);
          break;
        case 'rating':
          compareResult = a.rating - b.rating;
          break;
        case 'dateRead':
        default:
          compareResult = new Date(b.dateRead).getTime() - new Date(a.dateRead).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? compareResult : -compareResult;
    });
    
    setFilteredBooks(result);
    setActivePage(1); // Reset to first page when filters change
  }, [searchQuery, books, sortBy, sortOrder]);
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredBooks.length / ITEMS_PER_PAGE);
  const paginatedBooks = filteredBooks.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    fetchBooks();
  }, []);

  if (loading && books.length === 0) {
    return (
      <Container size="lg" py="xl" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingOverlay visible={loading} />
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
              {filteredBooks.length} books
            </Badge>
          </Group>
          <Button 
            leftSection={<IconRefresh size={16} />} 
            onClick={fetchBooks}
            loading={loading}
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
            disabled={loading}
          />
          
          <Select
            label="Sort by"
            value={sortBy}
            onChange={(value) => {
              if (value === 'title' || value === 'author' || value === 'rating' || value === 'dateRead') {
                setSortBy(value);
              }
            }}
            data={[
              { value: 'dateRead', label: 'Date Read' },
              { value: 'title', label: 'Title' },
              { value: 'author', label: 'Author' },
              { value: 'rating', label: 'Rating' },
            ]}
            style={{ width: 150 }}
            disabled={loading}
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
            disabled={loading}
          />
        </Group>
        
        <Text size="sm" c="dimmed">
          Showing {(activePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(activePage * ITEMS_PER_PAGE, filteredBooks.length)} of {filteredBooks.length} books
        </Text>
      </Stack>

      {error && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Error loading books" 
          color="red"
          mb="xl"
        >
          {error}
        </Alert>
      )}

      {!loading && filteredBooks.length === 0 ? (
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
            onClick={fetchBooks}
            loading={loading}
          >
            Try again
          </Button>
        </Box>
      ) : (
        <Stack gap="md" mt="md">
          {paginatedBooks.map((book, index) => (
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
                    backgroundColor: colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[1],
                    borderRadius: theme.radius.sm,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Image
                    src={book.coverImage}
                    height={110}
                    width={70}
                    fit="contain"
                    alt={`Cover of ${book.title}`}
                  />
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
                      <Rating value={book.rating} fractions={2} readOnly size="sm" />
                      <Text size="sm" fw={500}>
                        {book.rating.toFixed(1)}
                      </Text>
                    </Group>
                  </Group>
                  
                  <Text size="sm" c="dimmed">
                    Read on {new Date(book.dateRead).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
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
            <Box mt="xl" style={{ width: '100%' }}>
              <Pagination
                total={totalPages}
                value={activePage}
                onChange={setActivePage}
                siblings={1}
                boundaries={1}
                withEdges
                nextIcon={IconChevronRight}
                previousIcon={IconChevronLeft}
                getItemProps={() => ({
                  component: 'button',
                  style: { 
                    border: 'none', 
                    background: 'transparent',
                    padding: '8px 12px',
                    borderRadius: '4px',
                  },
                })}
                styles={(theme) => {
                  const isDark = colorScheme === 'dark';
                  return {
                    root: {
                      justifyContent: 'center',
                    },
                    control: {
                      '&[data-active]': {
                        backgroundColor: theme.colors.blue[6],
                        color: 'white',
                        '&:hover': {
                          backgroundColor: theme.colors.blue[7]
                        }
                      },
                      '&:not([data-disabled]):hover': {
                        backgroundColor: isDark ? theme.colors.dark[5] : theme.colors.gray[1],
                        color: isDark ? 'white' : 'black',
                      },
                    },
                  };
                }}
              />
            </Box>
          )}
        </Stack>
      )}
    </Container>
  );
}

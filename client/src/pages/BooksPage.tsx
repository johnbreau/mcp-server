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
  Anchor
} from '@mantine/core';
import { IconBook, IconAlertCircle, IconRefresh, IconSearch, IconExternalLink } from '@tabler/icons-react';

interface Book {
  title: string;
  author: string;
  coverImage: string;
  rating: number;
  dateRead: string;
  link: string;
}

export default function BooksPage() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/books/read');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load books');
      }
      
      // The API returns { success: true, data: books }
      // but the scraper returns the books array directly
      const booksData = Array.isArray(data) ? data : (data.data || []);
      setBooks(booksData);
      setFilteredBooks(booksData);
    } catch (err) {
      console.error('Error fetching books:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Filter books based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBooks(books);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = books.filter(book => 
        book.title.toLowerCase().includes(query) || 
        book.author.toLowerCase().includes(query)
      );
      setFilteredBooks(filtered);
    }
  }, [searchQuery, books]);

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
      <Group justify="space-between" mb="xl" align="center">
        <Group gap="xs">
          <IconBook size={32} />
          <Title order={1}>My Read Books</Title>
          <Badge color="blue" variant="filled" size="lg">
            {filteredBooks.length} of {books.length} books
          </Badge>
        </Group>
        <Button 
          leftSection={<IconRefresh size={16} />} 
          onClick={fetchBooks}
          loading={loading}
          variant="outline"
          mr="sm"
        >
          Refresh
        </Button>
        <TextInput
          placeholder="Search books..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          style={{ flex: 1, maxWidth: 300 }}
          disabled={loading}
        />
      </Group>

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
        <Stack gap="md" mt="xl">
          {filteredBooks.map((book, index) => (
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
        </Stack>
      )}
    </Container>
  );
}

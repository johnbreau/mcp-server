import { useEffect, useState } from 'react';
import { 
  Container, 
  Title, 
  Card, 
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
  SimpleGrid,
  useMantineTheme,
  useMantineColorScheme
} from '@mantine/core';
import { IconBook, IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import type { MantineTheme } from '@mantine/core';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/books/read');
      const data = await response.json();``
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load books');
      }
      
      setBooks(data.data || []);
    } catch (err) {
      console.error('Error fetching books:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

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
            {books.length} books
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

      {!loading && books.length === 0 ? (
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
        <SimpleGrid 
          cols={{ base: 1, sm: 2, md: 3, lg: 4 }} 
          spacing="lg" 
          mt="xl"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: theme.spacing.lg,
            marginTop: theme.spacing.xl,
          }}
        >
          {books.map((book, index) => (
            <Card 
              key={index}
              shadow="sm"
              padding="lg"
              radius="md"
              component="a"
              href={`https://goodreads.com${book.link}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                transition: 'all 0.2s ease',
              }}
              styles={{
                root: (theme: MantineTheme) => ({
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: theme.shadows.md,
                  },
                }),
              }}
            >
              <Card.Section>
                <Image
                  src={book.coverImage}
                  h={300}
                  alt={`Cover of ${book.title}`}
                  style={{
                    objectFit: 'contain',
                    backgroundColor: colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
                  }}
                />
              </Card.Section>

              <Stack gap="xs" mt="md" style={{ flexGrow: 1 }}>
                <Text 
                  lineClamp={2}
                  style={{
                    fontWeight: 600,
                    lineHeight: 1.2,
                    marginBottom: `calc(${theme.spacing.xs} / 2)`,
                  }}
                >
                  {book.title}
                </Text>
                <Text 
                  size="sm" 
                  lineClamp={1}
                  color={colorScheme === 'dark' ? 'dimmed' : 'gray.7'}
                >
                  {book.author}
                </Text>
                
                <Group justify="space-between" mt="auto" wrap="nowrap">
                  <Rating value={book.rating} readOnly size="sm" />
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    Read: {book.dateRead}
                  </Text>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
}

import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { Container, Title, Text, TextInput, Group, Loader, Paper, Badge, Card } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { SearchResult } from '../api/obsidian';
import { api } from '../api/obsidian';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery] = useDebouncedValue(query, 500);

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
  }, []);

  useEffect(() => {
    const search = async () => {
      if (debouncedQuery.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const data = await api.searchNotes(debouncedQuery, 10);
        setResults(data);
      } catch (error) {
        console.error('Error searching notes:', error);
      } finally {
        setLoading(false);
      }
    };

    search();
  }, [debouncedQuery]);

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="xl">
        Search Notes
      </Title>

      <TextInput
        placeholder="Search notes..."
        value={query}
        onChange={handleSearchChange}
        leftSection={<IconSearch size={16} />}
        style={{ marginBottom: '1.5rem' }}
        size="md"
      />

      {loading && (
        <Group style={{ justifyContent: 'center', marginTop: '2rem' }}>
          <Loader />
          <Text>Searching...</Text>
        </Group>
      )}

      {!loading && debouncedQuery.trim().length < 2 && (
        <Paper p="lg" radius="md" withBorder>
          <Text color="dimmed" style={{ textAlign: 'center' }}>
            Type at least 2 characters to start searching
          </Text>
        </Paper>
      )}

      {!loading && debouncedQuery.trim().length >= 2 && results.length === 0 && (
        <Paper p="lg" radius="md" withBorder>
          <Text color="dimmed" style={{ textAlign: 'center' }}>
            No results found for "{debouncedQuery}"
          </Text>
        </Paper>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {results.map((result, index) => (
          <Card key={index} withBorder shadow="sm" radius="md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <Text style={{ fontWeight: 600, WebkitLineClamp: 1, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {result.path}
              </Text>
              <Badge color="blue" variant="light">
                {Math.round(result.size / 1024)} KB
              </Badge>
            </div>
            <Text size="sm" color="dimmed" lineClamp={3}>
              {result.content}
            </Text>
            <Text size="xs" color="dimmed" mt="xs">
              Last modified: {new Date(result.lastModified).toLocaleString()}
            </Text>
          </Card>
        ))}
      </div>
    </Container>
  );
}

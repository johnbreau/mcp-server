import React, { useState, useEffect } from 'react';
import { Paper, Text, Title, Button, Group, LoadingOverlay } from '@mantine/core';
import { journalApi, type JournalEntry } from '../../api/journal';
import { format } from 'date-fns';

export const RandomJournalEntry: React.FC = () => {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRandomEntry = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const randomEntry = await journalApi.getRandomEntry();
      setEntry(randomEntry);
    } catch (err) {
      console.error('Error fetching random journal entry:', err);
      setError('Failed to load journal entry');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRandomEntry();
  }, []);

  if (isLoading) {
    return (
      <Paper p="md" withBorder style={{ minHeight: '200px', position: 'relative' }}>
        <LoadingOverlay visible={isLoading} />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper p="md" withBorder>
        <Text color="red">{error}</Text>
        <Button mt="md" onClick={fetchRandomEntry}>
          Try Again
        </Button>
      </Paper>
    );
  }

  if (!entry) {
    return (
      <Paper p="md" withBorder>
        <Text>No journal entries found.</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>
          {entry.title || 'Untitled'}
        </Title>
        <Text c="dimmed" size="sm">
          {format(new Date(entry.date), 'MMMM d, yyyy')}
        </Text>
      </Group>
      <Text style={{ whiteSpace: 'pre-line' }} mb="md">
        {entry.description}
      </Text>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {entry.metadata?.wordCount || 0} words
        </Text>
        <Button 
          variant="outline" 
          size="xs" 
          onClick={fetchRandomEntry}
        >
          Another Entry
        </Button>
      </Group>
    </Paper>
  );
};

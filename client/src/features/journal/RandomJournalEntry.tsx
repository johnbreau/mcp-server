import React, { useState, useEffect } from 'react';
import { Box, Paper, Text, Title, Button, Group, LoadingOverlay } from '@mantine/core';
import api from '../../../api';
import { format } from 'date-fns';

type JournalEntry = {
  id: string;
  title: string;
  description: string;
  date: string;
  metadata: {
    path: string;
    wordCount: number;
  };
};

export const RandomJournalEntry: React.FC = () => {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRandomEntry = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get('/timeline/random-journal');
      
      if (response.data.success && response.data.data) {
        setEntry({
          id: response.data.data.id,
          title: response.data.data.title,
          description: response.data.data.description || '',
          date: response.data.data.date,
          metadata: {
            path: response.data.data.metadata?.path || '',
            wordCount: response.data.data.metadata?.wordCount || 0
          }
        });
      } else {
        setError('No journal entries found');
      }
    } catch (err) {
      console.error('Error fetching random journal entry:', err);
      setError('Failed to load a random journal entry');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch a random entry when the component mounts
  useEffect(() => {
    fetchRandomEntry();
  }, []);

  return (
    <Paper p="md" shadow="sm" withBorder style={{ position: 'relative' }}>
      <LoadingOverlay visible={isLoading} />
      
      <Group justify="space-between" mb="md">
        <Title order={3}>Random Journal Entry</Title>
        <Button 
          variant="subtle" 
          size="sm" 
          onClick={fetchRandomEntry}
          disabled={isLoading}
        >
          Get Another
        </Button>
      </Group>
      
      {error ? (
        <Text color="red">{error}</Text>
      ) : entry ? (
        <Box>
          <Text color="dimmed" size="sm" mb="md">
            {format(new Date(entry.date), 'MMMM d, yyyy')} • {entry.metadata.wordCount} words
          </Text>
          
          <Text style={{ whiteSpace: 'pre-line' }}>
            {entry.description}
          </Text>
          
          {entry.metadata.path && (
            <Text size="sm" color="blue" mt="sm">
              From: {entry.metadata.path}
            </Text>
          )}
        </Box>
      ) : (
        <Text>No journal entries found</Text>
      )}
    </Paper>
  );
};

import { Title, Container, SimpleGrid, Space } from '@mantine/core';
import JournalsView from '../features/journals/JournalsView';
import { RandomJournalEntry } from '../features/journal/RandomJournalEntry';

export default function HomePage() {
  return (
    <Container size="xl" py="md">
      <Title order={1} mb="lg">Welcome to Breau Bot</Title>
      
      <SimpleGrid cols={2} spacing="lg">
        <JournalsView />
        <RandomJournalEntry />
      </SimpleGrid>
      
      <Space h="xl" />
      
      {/* Add more content sections here as needed */}
    </Container>
  );
}

import { Container, Title, Text, Stack } from '@mantine/core';
import { AIChat } from '../features/ai/AIChat';

export function AIPage() {
  return (
    <Container size="lg" style={{ height: '100%' }}>
      <Stack gap="md" h="100%">
        <div>
          <Title order={2}>AI Assistant</Title>
          <Text c="dimmed">Ask questions about your notes or get help finding information</Text>
        </div>
        <AIChat />
      </Stack>
    </Container>
  );
}

export default AIPage;

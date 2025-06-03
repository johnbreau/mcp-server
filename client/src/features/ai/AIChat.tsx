import { useState } from 'react';
import { 
  Paper, 
  TextInput, 
  Button, 
  Group, 
  Stack, 
  Text, 
  Avatar,
  ScrollArea,
  Box,
  LoadingOverlay
} from '@mantine/core';
import { IconSend, IconRobot, IconUser } from '@tabler/icons-react';
import { api } from '../../api/obsidian';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Use the appropriate API method based on the input
      let response: string;
      
      if (input.toLowerCase().startsWith('summarize')) {
        // For demo purposes, using the first note's content
        const notes = await api.listNotes();
        if (notes.length > 0) {
          const note = await api.getNote(notes[0].path);
          const result = await api.summarizeNote(note.content);
          if (result.success) {
            response = result.summary;
          } else {
            response = `Failed to generate summary: ${result.error || 'Unknown error'}`;
          }
        } else {
          response = 'No notes found to summarize.';
        }
      } else if (input.toLowerCase().includes('?')) {
        const result = await api.askQuestion(input);
        if (result.success) {
          // Access answer, context, and sources from the data object
          response = result.data.answer;
          // Add context and sources if available
          if (result.data.context || result.data.sources?.length) {
            response += '\n\n';
            if (result.data.context) response += `Context: ${result.data.context}\n`;
            if (result.data.sources?.length) response += `Sources: ${result.data.sources.join(', ')}`;
          }
        } else {
          response = `Error: ${result.message || 'Failed to get an answer'}`;
        }
      } else {
        const result = await api.semanticSearch(input, 3);
        if (result.success && result.data.results.length > 0) {
          response = `Found ${result.data.results.length} relevant notes.\n\n${result.data.reasoning || 'Relevant notes found:'}\n\n` +
            result.data.results.map(r => `**${r.path}**: ${r.content.substring(0, 200)}...`).join('\n\n');
        } else {
          response = result.data.reasoning || 'No relevant notes found.';
        }
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error instanceof Error ? error.message : 'Failed to process your request'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper p="md" withBorder style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
      <ScrollArea style={{ flex: 1, marginBottom: '1rem', minHeight: 'calc(70vh - 120px)' }}>
        <Stack gap="md">
          {messages.map((message) => (
            <Group 
              key={message.id} 
              align="flex-start" 
              style={{
                flexDirection: message.isUser ? 'row-reverse' : 'row',
              }}
            >
              <Avatar color={message.isUser ? 'blue' : 'teal'} radius="xl">
                {message.isUser ? <IconUser size="1.1rem" /> : <IconRobot size="1.1rem" />}
              </Avatar>
              <Box
                p="md"
                style={{
                  maxWidth: '70%',
                  borderRadius: '0.5rem',
                  backgroundColor: message.isUser ? '#e7f5ff' : '#f8f9fa',
                }}
              >
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  {message.timestamp.toLocaleTimeString()}
                </Text>
              </Box>
            </Group>
          ))}
        </Stack>
      </ScrollArea>
      
      <Group mt="auto" style={{ paddingTop: '1rem' }}>
        <TextInput
          placeholder="Ask me anything about your notes..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          style={{ flex: 1 }}
          disabled={isLoading}
        />
        <Button 
          leftSection={<IconSend size="1rem" />} 
          onClick={handleSendMessage}
          loading={isLoading}
          disabled={!input.trim()}
        >
          Send
        </Button>
      </Group>
      <LoadingOverlay visible={isLoading} />
    </Paper>
  );
}

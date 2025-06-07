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
import axios from 'axios';

// Create an axios instance for AI chat requests
const aiApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/ai',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 30000, // 30 second timeout for AI operations
});

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
      
      // Try to determine the type of request
      if (input.toLowerCase().includes('?')) {
        // Handle question
        const result = await aiApi.post('/ask', { question: input });
        response = result.data.answer || 'I couldn\'t find an answer to your question.';
        
        // Add context if available
        if (result.data.context) {
          response += `\n\nContext: ${result.data.context}`;
        }
        
        // Add sources if available
        if (result.data.sources?.length) {
          response += `\n\nSources: ${result.data.sources.join(', ')}`;
        }
      } else if (input.toLowerCase().startsWith('summarize')) {
        // Handle summarize request
        const result = await aiApi.post('/summarize', { content: input.replace(/^summarize\s*/i, '') });
        response = result.data.summary || 'I couldn\'t generate a summary.';
      } else {
        // Default to semantic search
        console.log('Sending semantic search request with query:', input);
        try {
          const result = await aiApi.post('/semantic-search', { 
            query: input,
            limit: 3 
          });
          
          console.log('Semantic search response:', result.data);
          
          if (result.data.results?.length > 0) {
            response = `Found ${result.data.results.length} relevant notes.\n\n`;
            response += result.data.results
              .map((r: { path: string; content: string }) => `**${r.path}**: ${r.content?.substring(0, 200)}...`)
              .join('\n\n');
            
            // Add reasoning if available
            if (result.data.reasoning) {
              response += `\n\n**Reasoning:** ${result.data.reasoning}`;
            }
          } else {
            response = 'No relevant notes found. ';
            if (result.data.reasoning) {
              response += `\n\n**Reasoning:** ${result.data.reasoning}`;
            } else {
              response += 'Try rephrasing your query or asking a question.';
            }
          }
        } catch (error: unknown) {
          console.error('Error performing semantic search:', error);
          response = 'Error performing search. Please try again later.';
          
          // Type-safe error handling
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { data?: { error?: string } } };
            if (axiosError.response?.data?.error) {
              response += `\n\nError details: ${axiosError.response.data.error}`;
            }
          }
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
                {message.isUser ? <IconUser size={18} /> : <IconRobot size={18} />}
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
          leftSection={<IconSend size={16} />} 
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

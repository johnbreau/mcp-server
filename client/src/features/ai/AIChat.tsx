import { useState, useRef, useEffect } from 'react';
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
  LoadingOverlay,
  useMantineTheme
} from '@mantine/core';
import { IconSend, IconRobot, IconUser } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import axios from 'axios';

// Create an axios instance for AI chat requests
const aiApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
  timeout: 30000, // 30 second timeout for AI operations
});

// Add request interceptor for logging
aiApi.interceptors.request.use(config => {
  console.log('Sending request to:', config.url);
  console.log('Request config:', {
    method: config.method,
    url: config.url,
    data: config.data,
    headers: config.headers
  });
  return config;
}, error => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

// Add response interceptor for logging
aiApi.interceptors.response.use(response => {
  console.log('Response received:', {
    status: response.status,
    statusText: response.statusText,
    data: response.data,
    headers: response.headers
  });
  return response;
}, error => {
  console.error('Response error:', {
    message: error.message,
    response: error.response ? {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
      headers: error.response.headers
    } : 'No response',
    config: error.config
  });
  return Promise.reject(error);
});

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function AIChat() {
  const theme = useMantineTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Prepare chat history
      const chatHistory: ChatMessage[] = messages.map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      // Add the new user message
      chatHistory.push({
        role: 'user',
        content: userInput
      });

      console.log('Sending chat request with messages:', chatHistory);
      const response = await aiApi.post('/ai/chat', { messages: chatHistory });
      console.log('Received response:', response.data);
      
      if (response.data && response.data.response) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response.data.response,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        console.error('Unexpected response format:', response.data);
        throw new Error('Unexpected response format from server');
      }
    } catch (error: unknown) {
      // Define a more specific type for the error
      interface AxiosErrorResponse {
        data?: { message?: string; [key: string]: unknown };
        status?: number;
        headers?: Record<string, string>;
      }

      interface AxiosError extends Error {
        response?: AxiosErrorResponse;
        request?: unknown;
      }

      const axiosError = error as AxiosError;
      console.error('Error sending message:', error);
      let errorMessage = 'Failed to send message. Please try again.';
      
      if (axiosError.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Response data:', axiosError.response.data);
        console.error('Response status:', axiosError.response.status);
        console.error('Response headers:', axiosError.response.headers);
        errorMessage = `Server error: ${axiosError.response.status} - ${axiosError.response.data?.message || 'Unknown error'}`;
      } else if (axiosError.request) {
        // The request was made but no response was received
        console.error('No response received:', axiosError.request);
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', axiosError.message);
        errorMessage = `Error: ${axiosError.message}`;
      }
      
      showNotification({ 
        title: 'Error', 
        message: errorMessage, 
        color: 'red' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test connection on component mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log('Testing connection to /api/ai/health');
        const response = await aiApi.get('/ai/health');
        console.log('Health check successful:', response.data);
        
        // Also test the chat endpoint
        try {
          console.log('Testing chat endpoint with empty message');
          const chatResponse = await aiApi.post('/ai/chat', { messages: [] });
          console.log('Chat test successful:', chatResponse.data);
        } catch (chatError) {
          console.error('Chat test failed (this might be expected):', chatError);
        }
      } catch (error) {
        console.error('Connection test failed:', error);
        
        // Try to get more details about the error
        try {
          const testResponse = await fetch('/api/ai/health');
          console.error('Raw health check response:', {
            status: testResponse.status,
            statusText: testResponse.statusText,
            headers: Object.fromEntries(testResponse.headers.entries()),
            body: await testResponse.text().catch(() => 'Could not read response body')
          });
        } catch (e) {
          console.error('Could not fetch health check:', e);
        }
      }
    };

    testConnection();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Paper 
      p="md" 
      withBorder 
      style={{
        height: '70vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <ScrollArea 
        style={{
          flex: 1,
          marginBottom: theme.spacing.md,
          minHeight: 'calc(70vh - 120px)',
        }}
      >
        <Stack>
          {messages.length === 0 ? (
            <Box style={{ textAlign: 'center', padding: '2rem' }}>
              <Text size="lg" color="dimmed">
                Ask me anything about your notes or search for information.
              </Text>
            </Box>
          ) : (
            messages.map((message) => (
              <div 
                key={message.id}
                style={{
                  display: 'flex',
                  flexDirection: message.isUser ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  marginBottom: theme.spacing.md,
                }}
                data-user={message.isUser}
              >
                <Avatar color={message.isUser ? 'blue' : 'teal'} radius="xl">
                  {message.isUser ? <IconUser size={18} /> : <IconRobot size={18} />}
                </Avatar>
                <div
                  style={{
                    maxWidth: '70%',
                    borderRadius: theme.radius.md,
                    padding: theme.spacing.md,
                    backgroundColor: message.isUser 
                      ? theme.colors.blue[1]
                      : theme.colors.gray[1],
                  }}
                  data-user={message.isUser}
                >
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Text>
                  <Text size="xs" color="dimmed" mt={4}>
                    {message.timestamp.toLocaleTimeString()}
                  </Text>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </Stack>
      </ScrollArea>
      
      <Group mt="auto" style={{ paddingTop: '1rem' }}>
        <TextInput
          placeholder="Ask me anything about your notes..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
          style={{ flex: 1 }}
          disabled={isLoading}
          radius="md"
        />
        <Button 
          leftSection={<IconSend size={16} />} 
          onClick={handleSendMessage}
          loading={isLoading}
          disabled={!input.trim() || isLoading}
          radius="md"
          style={{ whiteSpace: 'nowrap' }}
        >
          Send
        </Button>
      </Group>
      {isLoading && <LoadingOverlay visible />}
    </Paper>
  );
}

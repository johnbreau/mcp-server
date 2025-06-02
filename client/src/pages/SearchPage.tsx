import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import axios from 'axios';
import { 
  Container, 
  Title, 
  Text, 
  TextInput, 
  Loader, 
  Card, 
  Tabs,
  Stack,
  Button,
  Group,
  Paper,
  Badge
} from '@mantine/core';
import { IconSearch, IconRobot, IconMessage } from '@tabler/icons-react';
import { api } from '../api/obsidian';

// Type definitions
interface SearchResult {
  path: string;
  content: string;
  score?: number;
  relevance?: number;
}

interface SemanticSearchResponse {
  success: boolean;
  data: {
    results: SearchResult[];
    reasoning: string;
    total: number;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function SearchPage() {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 500);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('keyword');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [keywordResults, setKeywordResults] = useState<SearchResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResponse | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! How can I help you with your notes today?'
    }
  ]);
  const [messageInput, setMessageInput] = useState('');

  // Handle search input change
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle message input change
  const handleMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMessageInput(event.target.value);
  };

  // Perform keyword search
  const performKeywordSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setKeywordResults([]);
      return;
    }

    console.log('Performing keyword search for:', query);
    setIsSearching(true);
    setSearchError(null);

    try {
      console.log('Calling api.searchNotes with:', { query, limit: 5 });
      const results = await api.searchNotes(query, 5);
      console.log('Search results received:', results);
      setKeywordResults(results);
    } catch (error: unknown) {
      console.error('Search error:', error);
      let errorMessage = 'Failed to perform search';
      
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || error.message;
        console.error('Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setSearchError(`Error: ${errorMessage}`);
      setKeywordResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Perform semantic search
  const performSemanticSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSemanticResults(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await api.semanticSearch(query);
      setSemanticResults({
        success: result.success,
        data: {
          results: result.data.results || [],
          reasoning: result.data.reasoning || '',
          total: result.data.total || 0
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to perform semantic search';
      console.error('Semantic search error:', error);
      setSearchError(`Error: ${errorMessage}`);
      setSemanticResults({
        success: false,
        data: {
          results: [],
          reasoning: errorMessage,
          total: 0
        }
      });
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle search when debounced query changes
  useEffect(() => {
    if (activeTab === 'keyword') {
      performKeywordSearch(debouncedSearchQuery);
    } else if (activeTab === 'semantic') {
      performSemanticSearch(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, activeTab, performKeywordSearch, performSemanticSearch]);

  // Handle tab change
  const handleTabChange = (value: string | null) => {
    setActiveTab(value);
    if (value === 'keyword') {
      performKeywordSearch(searchQuery);
    } else if (value === 'semantic') {
      performSemanticSearch(searchQuery);
    } else if (value === 'chat') {
      // Initialize chat with a welcome message if empty
      if (messages.length === 0) {
        setMessages([
          {
            role: 'assistant',
            content: 'Hello! How can I help you with your notes today?'
          }
        ]);
      }
    }
  };

  // Handle sending a message (for chat functionality)
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim()) return;

    const userMessage: Message = { role: 'user', content: messageInput };
    setMessages(prev => [...prev, userMessage]);
    setMessageInput('');
    setIsSearching(true);

    try {
      // Call the API to get a response
      const response = await api.askQuestion(messageInput);
      
      // Log the full response for debugging
      console.log('AI Response:', response);
      
      // Check if the response is successful and has the expected structure
      if (response?.success && response.data?.answer) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.data.answer
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSearching(false);
    }
  }, [messageInput]);

  // Handle pressing Enter in the message input
  const handleMessageKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="xl">Search Notes</Title>
      
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="keyword" leftSection={<IconSearch size={14} />}>
            Keyword Search
          </Tabs.Tab>
          <Tabs.Tab value="semantic" leftSection={<IconRobot size={14} />}>
            AI Semantic Search
          </Tabs.Tab>
          <Tabs.Tab value="chat" leftSection={<IconMessage size={14} />}>
            AI Chat
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="keyword" pt="md">
          <TextInput
            placeholder="Search by keyword..."
            value={searchQuery}
            onChange={handleSearchChange}
            rightSection={isSearching ? <Loader size="sm" /> : <IconSearch size={16} />}
            mb="md"
          />

          {searchError && (
            <Text color="red" size="sm" mb="md">
              {searchError}
            </Text>
          )}
          {isSearching && searchQuery ? (
            <Loader />
          ) : keywordResults.length > 0 ? (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Found {keywordResults.length} results for "{searchQuery}"
              </Text>
              <Stack gap="md">
                {keywordResults.map((result, index) => (
                  <Card key={index} withBorder>
                    <Text fw={500}>{result.path}</Text>
                    <Text size="sm" lineClamp={2}>
                      {result.content}
                    </Text>
                    {result.score !== undefined && (
                      <Badge color="blue" size="sm" mt="xs">
                        Score: {result.score.toFixed(2)}
                      </Badge>
                    )}
                  </Card>
                ))}
              </Stack>
            </Stack>
          ) : searchQuery ? (
            <Text>No results found for "{searchQuery}"</Text>
          ) : (
            <Text>Enter a search term to find notes</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="semantic" pt="md">
          <TextInput
            placeholder="Ask a question about your notes..."
            value={searchQuery}
            onChange={handleSearchChange}
            rightSection={isSearching ? <Loader size="sm" /> : <IconSearch size={16} />}
            mb="md"
          />

          {searchError && activeTab === 'semantic' && (
            <Text color="red" size="sm" mb="md">
              {searchError}
            </Text>
          )}

          {isSearching && searchQuery ? (
            <Loader />
          ) : semanticResults?.success ? (
            <Stack gap="md">
              {semanticResults.data.reasoning && (
                <Paper p="md" withBorder>
                  <Text fw={500}>AI Analysis:</Text>
                  <Text>{semanticResults.data.reasoning}</Text>
                </Paper>
              )}
              
              {semanticResults.data.results?.length > 0 ? (
                <>
                  <Text size="sm" c="dimmed">
                    Found {semanticResults.data.results.length} relevant notes:
                  </Text>
                  
                  {semanticResults.data.results.map((result, index) => (
                    <Card key={index} withBorder>
                      <Text fw={500}>{result.path}</Text>
                      <Text size="sm" lineClamp={3}>
                        {result.content}
                      </Text>
                      {result.relevance !== undefined && (
                        <Badge color="green" size="sm" mt="xs">
                          Relevance: {(result.relevance * 100).toFixed(1)}%
                        </Badge>
                      )}
                    </Card>
                  ))}
                </>
              ) : (
                <Text>No results found for your search.</Text>
              )}
            </Stack>
          ) : semanticResults?.success === false ? (
            <Text color="red">Error: {semanticResults.data.reasoning || 'Failed to perform search'}</Text>
          ) : searchQuery ? (
            <Text>No semantic results found for "{searchQuery}"</Text>
          ) : (
            <Text>Ask a question to search your notes using AI</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="chat" pt="md">
          <Stack gap="md" style={{ height: '60vh' }}>
            <Paper p="md" withBorder style={{ flex: 1, overflowY: 'auto' }}>
              <Stack gap="md">
                {messages.map((message, index) => (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: '1rem',
                    }}
                  >
                    <div 
                      style={{
                        maxWidth: '80%',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: message.role === 'user' ? '#e3f2fd' : '#f5f5f5',
                      }}
                    >
                      <Text>{message.content}</Text>
                    </div>
                  </div>
                ))}
              </Stack>
            </Paper>
            
            <Group gap="xs">
              <TextInput
                placeholder="Type your message..."
                value={messageInput}
                onChange={handleMessageChange}
                onKeyDown={handleMessageKeyDown}
                style={{ flex: 1 }}
              />
              <Button 
                onClick={handleSendMessage}
                loading={isSearching}
              >
                Send
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}

export default SearchPage;

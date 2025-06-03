import { useState, useCallback, useRef } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { 
  Container, 
  Title, 
  Text, 
  TextInput, 
  Button, 
  Switch, 
  Loader, 
  Tabs, 
  Paper, 
  Stack, 
  Progress, 
  Modal, 
  Badge,
  ActionIcon
} from '@mantine/core';
import { IconSearch, IconMessage, IconSend } from '@tabler/icons-react';
// API client for backend communication
const API_BASE_URL = 'http://localhost:3000/api';

const api = {
  searchNotes: async (query: string) => {
    try {
      const url = `${API_BASE_URL}/tools/obsidian`;
      console.log('Fetching from URL (searchNotes):', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'search',
          query,
          limit: 10
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Raw data from backend (searchNotes):', JSON.stringify(data, null, 2));
      // Map the backend results to the expected frontend format
      const results = data && data.data && Array.isArray(data.data.results) ? data.data.results as BackendSearchResult[] : [];
      return results.map((result, index) => ({
        id: result.path || `result-${index}`,
        title: result.path ? result.path.split('/').pop() || 'Untitled' : 'Untitled',
        content: result.content || '',
        path: result.path || '',
        lastModified: result.lastModified || new Date().toISOString(),
        size: result.size || 0
      }));
    } catch (error) {
      console.error('Error searching notes:', error);
      throw error;
    }
  },
  
  semanticSearch: async (query: string) => {
    try {
      const url = `${API_BASE_URL}/ai/semantic-search`;
      console.log('Fetching from URL (semanticSearch):', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: 10
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Raw data from backend (semanticSearch):', JSON.stringify(data, null, 2));
      // Map the semantic search results to the expected frontend format
      const results = data && data.data && Array.isArray(data.data.results) ? data.data.results as BackendSearchResult[] : [];
      return results.map((result, index) => ({
        id: result.path || `result-${index}`,
        title: result.path ? result.path.split('/').pop() || 'Untitled' : 'Untitled',
        content: result.content || '',
        path: result.path || '',
        score: result.score,
        lastModified: result.lastModified || new Date().toISOString(),
        size: result.size || 0
      }));
    } catch (error) {
      console.error('Error performing semantic search:', error);
      throw error;
    }
  }
};

// Type definitions
type IndexingStatus = 'idle' | 'indexing' | 'complete' | 'error';
type SearchTab = 'keyword' | 'semantic' | 'chat';

interface BackendSearchResult {
  path: string;
  content: string;
  lastModified?: string;
  size?: number;
  score?: number;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  path: string;
  lastModified: string;
  size: number;
  score?: number;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  activeTab: SearchTab;
  useSemanticSearch: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  messageInput: string;
  isSending: boolean;
}

interface IndexingState {
  isModalOpen: boolean;
  status: IndexingStatus;
  progress: number;
  error: string | null;
}

export function SearchPage() {
  // State
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    isLoading: false,
    error: null,
    activeTab: 'keyword',
    useSemanticSearch: false,
  });

  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    messageInput: '',
    isSending: false,
  });

  const [indexingState, setIndexingState] = useState<IndexingState>({
    isModalOpen: false,
    status: 'idle',
    progress: 0,
    error: null,
  });

  // Refs for state to avoid stale closures in callbacks
  const searchStateRef = useRef(searchState);
  searchStateRef.current = searchState;

  const chatStateRef = useRef(chatState);
  chatStateRef.current = chatState;

  // Debounced query for search optimization
  useDebouncedValue(searchState.query, 300);

  // Search handlers
  const handleSearchSubmit = useCallback(async (): Promise<void> => {
    const { query, useSemanticSearch } = searchStateRef.current;
    if (!query.trim()) {
      setSearchState((prev: SearchState) => ({
        ...prev,
        results: [],
        error: null
      }));
      return;
    }

    try {
      setSearchState((prev: SearchState) => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      let searchResults: SearchResult[] = [];
      
      if (useSemanticSearch) {
        const apiResponse = await api.semanticSearch(query);
        console.log('Processed results from api.semanticSearch:', JSON.stringify(apiResponse, null, 2));
        searchResults = Array.isArray(apiResponse) ? apiResponse : [];
      } else {
        const apiResponse = await api.searchNotes(query);
        console.log('Processed results from api.searchNotes:', JSON.stringify(apiResponse, null, 2));
        searchResults = Array.isArray(apiResponse) ? apiResponse : [];
      }

      setSearchState((prev: SearchState) => ({
        ...prev,
        results: searchResults, // Use the correctly populated searchResults here
        isLoading: false,
        error: searchResults.length === 0 
          ? 'No results found. Try different keywords or enable semantic search for more relevant results.' 
          : null
      }));


    } catch (error) {
      console.error('Search error:', error);
      setSearchState((prev: SearchState) => ({
        ...prev,
        isLoading: false,
        error: 'An error occurred while searching. Please try again.'
      }));
    }
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchState((prev: SearchState) => ({
      ...prev,
      query: event.target.value,
      error: null
    }));
  }, []);

  const handleSemanticToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchState((prev: SearchState) => ({
      ...prev,
      useSemanticSearch: event.currentTarget.checked,
      activeTab: event.currentTarget.checked ? 'semantic' : 'keyword',
      results: []
    }));
  }, []);

  const handleSearchKeyPress = useCallback((event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchSubmit();
    }
  }, [handleSearchSubmit]);

  // Open indexing modal - used in JSX
  const openIndexingModal = useCallback((): void => {
    setIndexingState((prev: IndexingState) => ({
      ...prev,
      isModalOpen: true,
      status: 'idle',
      progress: 0
    }));
  }, []);

  // Chat handlers
  const handleSendMessage = useCallback(async (): Promise<void> => {
    const { messageInput } = chatStateRef.current;
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: trimmedMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setChatState((prev: ChatState) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      messageInput: '',
      isSending: true
    }));

    try {
      // Simulate AI response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `This is a simulated response to: ${trimmedMessage}`,
        sender: 'assistant',
        timestamp: new Date()
      };

      setChatState((prev: ChatState) => ({
        ...prev,
        messages: [...prev.messages, aiResponse],
        isSending: false
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      setChatState((prev: ChatState) => ({
        ...prev,
        isSending: false
      }));
    }
  }, []);

  const handleMessageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setChatState((prev: ChatState) => ({
      ...prev,
      messageInput: event.target.value
    }));
  }, []);

  const handleChatKeyPress = useCallback((event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Indexing handlers
  const closeIndexingModal = useCallback((): void => {
    setIndexingState((prev: IndexingState) => ({
      ...prev,
      isModalOpen: false,
      status: 'idle',
      progress: 0,
      error: null
    }));
  }, []);

  const handleIndexVault = useCallback(async (): Promise<void> => {
    setIndexingState((prev: IndexingState) => ({
      ...prev,
      status: 'indexing',
      progress: 0,
      error: null
    }));

    try {
      // Simulate indexing progress (replace with actual API call)
      const totalSteps = 10;
      for (let i = 0; i <= totalSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const progress = Math.min(100, Math.round((i / totalSteps) * 100));
        
        setIndexingState((prev: IndexingState) => ({
          ...prev,
          progress,
          status: progress === 100 ? 'complete' : 'indexing'
        }));
      }
    } catch (error) {
      console.error('Indexing error:', error);
      setIndexingState((prev: IndexingState) => ({
        ...prev,
        status: 'error',
        error: 'Failed to index vault. Please try again.'
      }));
    }
  }, []);

  const { query, results, isLoading, error, activeTab, useSemanticSearch } = searchState;
  const { messages, messageInput, isSending } = chatState;
  const { isModalOpen, status, progress } = indexingState;

  return (
    <Container size="lg" py="xl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Title order={2}>Search Notes</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Switch
            label="Use Semantic Search"
            checked={useSemanticSearch}
            onChange={handleSemanticToggle}
          />
          <Button
            leftSection={<IconMessage size={16} />}
            onClick={openIndexingModal}
            variant="outline"
          >
            Index Vault
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <TextInput
          placeholder="Search your notes..."
          value={query}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyPress}
          rightSection={
            isLoading ? (
              <Loader size="xs" />
            ) : (
              <ActionIcon onClick={handleSearchSubmit}>
                <IconSearch size={16} />
              </ActionIcon>
            )
          }
        />
      </div>

      <Tabs value={activeTab} onChange={(value: string | null) => {
        if (value) {
          setSearchState(prev => ({ ...prev, activeTab: value as SearchTab }));
        }
      }}>
        <Tabs.List>
          <Tabs.Tab value="keyword">Keyword</Tabs.Tab>
          <Tabs.Tab value="semantic">Semantic</Tabs.Tab>
          <Tabs.Tab value="chat">Chat</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="keyword" pt="md">
          {error ? (
            <Text c="red">{error}</Text>
          ) : results.length > 0 ? (
            <Stack gap="md">
              {results.map((result) => (
                <Paper key={result.id} p="md" shadow="xs">
                  <Title order={4}>{result.title}</Title>
                  <Text size="sm" c="dimmed">{result.path}</Text>
                  <Text mt="xs">{result.content.substring(0, 200)}...</Text>
                  {result.score !== undefined && (
                    <Badge color="blue" mt="xs">
                      Score: {result.score.toFixed(2)}
                    </Badge>
                  )}
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text>No results found. Try a different search query.</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="semantic" pt="md">
          {error ? (
            <Text c="red">{error}</Text>
          ) : results.length > 0 ? (
            <Stack gap="md">
              {results.map((result) => (
                <Paper key={result.id} p="md" shadow="xs">
                  <Title order={4}>{result.title}</Title>
                  <Text size="sm" c="dimmed">{result.path}</Text>
                  <Text mt="xs">{result.content.substring(0, 200)}...</Text>
                  {result.score !== undefined && (
                    <Badge color="blue" mt="xs">
                      Score: {result.score.toFixed(2)}
                    </Badge>
                  )}
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text>No semantic results found. Try a different search query.</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="chat" pt="md">
          <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              <Stack gap="md">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Paper
                      p="md"
                      shadow="xs"
                      style={{
                        maxWidth: '80%',
                        backgroundColor: message.sender === 'user' ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-white)',
                      }}
                    >
                      <Text size="sm" c="dimmed">
                        {message.sender === 'user' ? 'You' : 'Assistant'}
                      </Text>
                      <Text>{message.content}</Text>
                      <Text size="xs" c="dimmed" mt={4}>
                        {message.timestamp.toLocaleTimeString()}
                      </Text>
                    </Paper>
                  </div>
                ))}
              </Stack>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <TextInput
                placeholder="Type a message..."
                value={messageInput}
                onChange={handleMessageChange}
                onKeyDown={handleChatKeyPress}
                style={{ flex: 1 }}
              />
              <Button
                onClick={handleSendMessage}
                loading={isSending}
                leftSection={<IconSend size={16} />}
              >
                Send
              </Button>
            </div>
          </div>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={isModalOpen}
        onClose={closeIndexingModal}
        title="Indexing Vault"
        size="lg"
      >
        <div style={{ textAlign: 'center' }}>
          <Text mb="md">
            {status === 'indexing'
              ? 'Indexing your vault...'
              : status === 'complete'
              ? 'Indexing complete!'
              : 'Ready to index your vault?'}
          </Text>
          
          {status === 'indexing' && (
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Progress
                value={progress}
                size="lg"
                radius="xl"
                animated
                mb="md"
              />
              <Text 
                size="sm" 
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                {Math.round(progress)}%
              </Text>
            </div>
          )}

          {status === 'complete' ? (
            <Button onClick={closeIndexingModal} fullWidth>
              Close
            </Button>
          ) : (
            <Button
              onClick={handleIndexVault}
              loading={status === 'indexing'}
              fullWidth
            >
              {status === 'indexing' ? 'Indexing...' : 'Start Indexing'}
            </Button>
          )}
        </div>
      </Modal>
    </Container>
  );
};

export default SearchPage;

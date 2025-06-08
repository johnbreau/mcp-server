import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { 
  Container, 
  Title, 
  Text, 
  TextInput, 
  Button, 
  Loader, 
  Tabs, 
  Paper, 
  Stack, 
  Group,
  Badge,
  Card
} from '@mantine/core';
import { IconSearch, IconBook, IconMessage, IconBrain } from '@tabler/icons-react';
import { api } from '../api/obsidian';

interface SearchResult {
  path: string;
  content: string;
  lastModified: string;
  size: number;
  score?: number;
  relevance?: number;
}

interface SemanticResult {
  reasoning: string;
  results: Array<SearchResult & { relevance: number }>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState<string | null>('keywords');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [keywordResults, setKeywordResults] = useState<SearchResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticResult | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleSearch = useCallback(async () => {
    if (!debouncedQuery.trim()) {
      setKeywordResults([]);
      setSemanticResults(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      if (activeTab === 'keywords') {
        const results = await api.searchNotes(debouncedQuery, 10);
        setKeywordResults(results);
      } else if (activeTab === 'semantic') {
        const response = await fetch(`/api/obsidian/semantic?q=${encodeURIComponent(debouncedQuery)}`);
        if (!response.ok) throw new Error('Failed to perform semantic search');
        const data = await response.json();
        setSemanticResults(data);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Failed to perform search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [debouncedQuery, activeTab]);

  useEffect(() => {
    if (activeTab === 'chat') return;
    handleSearch();
  }, [activeTab, debouncedQuery, handleSearch]);

  const handleMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(event.target.value);
  };

  const handleMessageKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    const userMessage: Message = { role: 'user', content: messageInput };
    setMessages(prev => [...prev, userMessage]);
    setMessageInput('');
    setIsSearching(true);

    try {
      const response = await fetch('/api/obsidian/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) throw new Error('Failed to get response');
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="xl">
        Search Notes
      </Title>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="keywords" leftSection={<IconSearch size={14} />}>
            Keyword Search
          </Tabs.Tab>
          <Tabs.Tab value="semantic" leftSection={<IconBrain size={14} />}>
            Semantic Search
          </Tabs.Tab>
          <Tabs.Tab value="chat" leftSection={<IconMessage size={14} />}>
            Chat with Notes
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="keywords" pt="md">
          <TextInput
            placeholder="Search notes by keywords..."
            value={searchQuery}
            onChange={handleSearchChange}
            rightSection={isSearching ? <Loader size="sm" /> : <IconSearch size={16} />}
            mb="md"
          />

          {searchError && activeTab === 'keywords' && (
            <Text color="red" size="sm" mb="md">
              {searchError}
            </Text>
          )}

          {isSearching && searchQuery ? (
            <Loader />
          ) : keywordResults.length > 0 ? (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Found {keywordResults.length} results:
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
          ) : semanticResults ? (
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Text fw={500}>AI Analysis:</Text>
                <Text>{semanticResults.reasoning}</Text>
              </Paper>
              
              <Text size="sm" c="dimmed">
                Found {semanticResults.results.length} relevant notes:
              </Text>
              
              {semanticResults.results.map((result, index) => (
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
            </Stack>
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
                <div ref={messagesEndRef} />
              </Stack>
            </Paper>
            
            <Group gap="xs">
              <TextInput
                placeholder="Type your message..."
                value={messageInput}
                onChange={handleMessageChange}
                onKeyDown={handleMessageKeyDown}
                style={{ flex: 1 }}
                disabled={isSearching}
              />
              <Button 
                onClick={handleSendMessage}
                loading={isSearching}
                disabled={!messageInput.trim()}
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

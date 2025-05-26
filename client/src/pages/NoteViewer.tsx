import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './NoteViewer.module.css';
import { 
  Container, 
  Title, 
  Text, 
  Group, 
  Paper, 
  Loader, 
  ActionIcon,
  Code,
  Button,
  Divider,
  Box
} from '@mantine/core';
import { IconArrowLeft, IconEdit, IconExternalLink } from '@tabler/icons-react';
import { api } from '../api/obsidian';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

export default function NoteViewer() {
  const { '*': path } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadNote = async () => {
      if (!path) {
        setError('No note path provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await api.getNote(path);
        setContent(data.content);
        setError('');
      } catch (err) {
        console.error('Error loading note:', err);
        setError('Failed to load note. It might not exist or you might not have permission to view it.');
      } finally {
        setLoading(false);
      }
    };

    loadNote();
  }, [path]);

  const navigateBack = () => {
    const pathParts = path?.split('/').filter(Boolean) || [];
    pathParts.pop();
    navigate(pathParts.length > 0 ? `/notes/${pathParts.join('/')}` : '/notes');
  };

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Group justify="center" mt="xl">
          <Loader />
          <Text>Loading note...</Text>
        </Group>
      </Container>
    );
  }


  if (error) {
    return (
      <Container size="lg" py="xl">
        <Paper p="lg" radius="md" withBorder>
          <Text color="red">{error}</Text>
          <Button 
            leftSection={<IconArrowLeft size={16} />} 
            onClick={navigateBack}
            mt="md"
            variant="outline"
          >
            Go Back
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="md">
        <Group>
          <ActionIcon 
            variant="outline" 
            onClick={navigateBack}
            title="Go back"
            mr="sm"
          >
            <IconArrowLeft size={16} />
          </ActionIcon>
          <Title order={2}>
            {path?.split('/').pop()}
          </Title>
        </Group>
        <Group>
          <Button 
            leftSection={<IconEdit size={16} />}
            variant="outline"
            onClick={() => window.alert('Edit functionality coming soon!')}
          >
            Edit
          </Button>
        </Group>
      </Group>

      <Divider my="md" />

      <Paper p="lg" radius="md" withBorder>
        <Box className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              code({inline, className, children, ...props}: {inline?: boolean, className?: string, children?: React.ReactNode}) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <Code block className={className} {...props}>
                    {String(children).replace(/\n$/, '')}
                  </Code>
                ) : (
                  <Code className={className} {...props}>
                    {children}
                  </Code>
                );
              },
              a({ ...props }) {
                return (
                  <a 
                    {...props} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.linkHover}
                  >
                    {props.children}
                    <IconExternalLink size={14} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                  </a>
                );
              },
              img({ ...props }) {
                return <img {...props} style={{ maxWidth: '100%' }} alt={props.alt || ''} />;
              },
              table({ ...props }) {
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table 
                      {...props} 
                      style={{ 
                        borderCollapse: 'collapse',
                        width: '100%',
                        margin: '16px 0',
                      }} 
                    />
                  </div>
                );
              },
              th({ ...props }) {
                return <th {...props} style={{ border: '1px solid #dee2e6', padding: '8px 12px', textAlign: 'left' }} />;
              },
              td({ ...props }) {
                return <td {...props} style={{ border: '1px solid #dee2e6', padding: '8px 12px' }} />;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </Box>
      </Paper>
    </Container>
  );
}

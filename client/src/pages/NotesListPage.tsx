import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Title, 
  Text, 
  Group, 
  Card, 
  Breadcrumbs, 
  Anchor, 
  Loader, 
  Paper,
  Badge,
  ActionIcon
} from '@mantine/core';
import { IconFolder, IconFileText, IconArrowLeft } from '@tabler/icons-react';
import type { NoteInfo } from '../api/obsidian';
import { api } from '../api/obsidian';

export default function NotesListPage() {
  const { '*': path = '' } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteInfo[]>([]);
  const [directories, setDirectories] = useState<NoteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    const loadNotes = async () => {
      setLoading(true);
      try {
        const data = await api.listNotes(path);
        
        // Separate directories and files
        const dirs = data.filter(item => item.path.endsWith('/'));
        const files = data.filter(item => !item.path.endsWith('/'));
        
        setDirectories(dirs);
        setNotes(files);
        setCurrentPath(path);
      } catch (error) {
        console.error('Error loading notes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [path]);

  const navigateToPath = (newPath: string) => {
    navigate(`/notes/${newPath}`);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const pathParts = currentPath.split('/').filter(Boolean);
    pathParts.pop(); // Remove the last part
    navigate(`/notes/${pathParts.join('/')}`);
  };

  const breadcrumbs = [
    { title: 'Home', path: '' },
    ...currentPath.split('/')
      .filter(Boolean)
      .map((part, index, parts) => ({
        title: part,
        path: parts.slice(0, index + 1).join('/') + (index < parts.length - 1 ? '/' : '')
      }))
  ];

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Group style={{ justifyContent: 'center', marginTop: '2rem' }}>
          <Loader />
          <Text>Loading...</Text>
        </Group>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Group style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <Title order={2}>
          {currentPath ? currentPath.split('/').filter(Boolean).pop() : 'Notes'}
        </Title>
        
        {currentPath && (
          <ActionIcon 
            variant="outline" 
            onClick={navigateUp}
            title="Go up one level"
          >
            <IconArrowLeft size={16} />
          </ActionIcon>
        )}
      </Group>

      <Breadcrumbs mb="xl" separator="→">
        {breadcrumbs.map((item, index) => (
          <Anchor
            key={index}
            onClick={() => navigateToPath(item.path)}
            style={{ cursor: 'pointer' }}
          >
            {item.title || 'Home'}
          </Anchor>
        ))}
      </Breadcrumbs>

      <Group style={{ gap: '1rem', marginBottom: '2rem' }}>
        {directories.map((dir) => (
          <Card
            key={dir.path}
            shadow="sm"
            p="md"
            radius="md"
            withBorder
            style={{
              cursor: 'pointer',
              border: '1px solid #dee2e6',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4dabf7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
            onClick={() => navigateToPath(dir.path)}
          >
            <Group>
              <IconFolder size={24} color="#4dabf7" />
              <Text style={{ fontWeight: 500 }}>
                {dir.name}
              </Text>
            </Group>
          </Card>
        ))}
      </Group>

      {notes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notes.map((note) => (
            <Paper
              key={note.path}
              p="md"
              withBorder
              styles={{
                root: {
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    '@media (prefers-color-scheme: dark)': {
                      backgroundColor: 'var(--mantine-color-dark-6)',
                    },
                  },
                },
              }}
              onClick={() => navigate(`/note${note.path}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconFileText size={20} />
                  <Text>{note.name}</Text>
                </div>
                <Badge color="gray" variant="outline">
                  {Math.round(note.size / 1024)} KB
                </Badge>
              </div>
              <Text size="sm" color="dimmed" mt={4}>
                Last modified: {new Date(note.lastModified).toLocaleString()}
              </Text>
            </Paper>
          ))}
        </div>
      ) : (
        <Paper p="lg" radius="md" withBorder>
          <Text color="dimmed" style={{ textAlign: 'center' }}>
            {directories.length === 0 ? 'No notes found in this directory' : 'No notes in this directory'}
          </Text>
        </Paper>
      )}
    </Container>
  );
}

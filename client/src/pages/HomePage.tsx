import { Card, Title, Text, Container, SimpleGrid } from '@mantine/core';
import { IconSearch, IconList, IconBook } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <IconSearch size={32} />,
      title: 'Search Notes',
      description: 'Quickly find notes containing specific text',
      action: () => navigate('/search'),
    },
    {
      icon: <IconList size={32} />,
      title: 'Browse Notes',
      description: 'Explore your notes by directory',
      action: () => navigate('/notes'),
    },
    {
      icon: <IconBook size={32} />,
      title: 'View Notes',
      description: 'Read and manage your notes',
      action: () => navigate('/notes'),
    },
  ];

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="md" ta="center">Welcome to Obsidian Vault Explorer</Title>
      <Text color="dimmed" mb="xl" ta="center">
        A simple interface to browse and search your Obsidian vault
      </Text>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {features.map((feature, index) => (
          <Card
            key={index}
            shadow="sm"
            p="lg"
            radius="md"
            withBorder
            onClick={feature.action}
            styles={{
              root: {
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)'
                }
              }
            }}
          >
            <Card.Section
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '2rem 0',
                backgroundColor: 'var(--mantine-color-blue-0)'
              }}
            >
              <div style={{ color: 'var(--mantine-color-blue-6)' }}>
                {feature.icon}
              </div>
            </Card.Section>
            <div style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
              <Title order={3} mb="sm">
                {feature.title}
              </Title>
              <Text c="dimmed" size="sm">
                {feature.description}
              </Text>
            </div>
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
}

import { useState } from 'react';
import { 
  Paper, 
  Title, 
  Text, 
  Button, 
  Group, 
  Stack, 
  Box,
  SegmentedControl,
  Divider,
  Badge,
  Tabs,
  ThemeIcon,
  SimpleGrid,
  Card,
  Center,
  rem,
  Textarea,
  Modal,
  ActionIcon
} from '@mantine/core';
import { 
  IconMoodHappy, 
  IconMoodSmile, 
  IconMoodNeutral, 
  IconMoodSad, 
  IconMoodCry, 
  IconBolt,
  IconBoltOff,
  IconBoltFilled,
  IconChartLine,
  IconCalendar,
  IconList,
  IconPlus,
  IconTrash,
  IconEdit
} from '@tabler/icons-react';

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';
type ViewMode = 'chart' | 'calendar' | 'list';

interface StateOfMindEntry {
  id: string;
  date: Date;
  mood: 'VERY_PLEASANT' | 'PLEASANT' | 'NEUTRAL' | 'UNPLEASANT' | 'VERY_UNPLEASANT';
  energy: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
  note?: string;
  tags?: string[];
}

const moodOptions = [
  { value: 'VERY_PLEASANT', label: 'Very Pleasant', icon: <IconMoodHappy size={24} />, color: 'green' },
  { value: 'PLEASANT', label: 'Pleasant', icon: <IconMoodSmile size={24} />, color: 'teal' },
  { value: 'NEUTRAL', label: 'Neutral', icon: <IconMoodNeutral size={24} />, color: 'yellow' },
  { value: 'UNPLEASANT', label: 'Unpleasant', icon: <IconMoodSad size={24} />, color: 'orange' },
  { value: 'VERY_UNPLEASANT', label: 'Very Unpleasant', icon: <IconMoodCry size={24} />, color: 'red' },
];

const energyOptions = [
  { value: 'VERY_HIGH', label: 'Very High', icon: <IconBoltFilled size={20} />, color: 'blue' },
  { value: 'HIGH', label: 'High', icon: <IconBolt size={20} />, color: 'indigo' },
  { value: 'MEDIUM', label: 'Medium', icon: <IconBolt size={20} />, color: 'violet' },
  { value: 'LOW', label: 'Low', icon: <IconBoltOff size={20} />, color: 'pink' },
  { value: 'VERY_LOW', label: 'Very Low', icon: <IconBoltOff size={20} />, color: 'red' },
];

// Generate mock data
const generateMockData = (count: number): StateOfMindEntry[] => {
  const entries: StateOfMindEntry[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 180); // Last 6 months
    const date = new Date(now);
    date.setDate(now.getDate() - daysAgo);
    
    const mood = moodOptions[Math.floor(Math.random() * moodOptions.length)].value as StateOfMindEntry['mood'];
    const energy = energyOptions[Math.floor(Math.random() * energyOptions.length)].value as StateOfMindEntry['energy'];
    
    entries.push({
      id: `entry-${i}`,
      date,
      mood,
      energy,
      note: Math.random() > 0.5 ? `Sample note for ${date.toLocaleDateString()}` : undefined,
      tags: Math.random() > 0.7 ? ['Work', 'Exercise'].slice(0, Math.floor(Math.random() * 2) + 1) : []
    });
  }
  
  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
};

export const StateOfMindTracker = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [entries, setEntries] = useState<StateOfMindEntry[]>(() => generateMockData(30));
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddEntry = () => {
    if (!selectedMood || !selectedEnergy) return;
    
    const newEntry: StateOfMindEntry = {
      id: `entry-${Date.now()}`,
      date: new Date(),
      mood: selectedMood as StateOfMindEntry['mood'],
      energy: selectedEnergy as StateOfMindEntry['energy'],
      note: note.trim() || undefined
    };
    
    setEntries([newEntry, ...entries]);
    setSelectedMood(null);
    setSelectedEnergy(null);
    setNote('');
    setIsModalOpen(false);
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(entries.filter(entry => entry.id !== id));
  };

  // Filter entries based on selected time range
  const filteredEntries = entries.filter(entry => {
    const now = new Date();
    const entryDate = new Date(entry.date);
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    switch(timeRange) {
      case '1W': return diffDays <= 7;
      case '1M': return diffDays <= 30;
      case '3M': return diffDays <= 90;
      case '6M': return diffDays <= 180;
      case '1Y': return diffDays <= 365;
      default: return true;
    }
  });

  return (
    <Stack spacing="md">
      <Group position="apart">
        <Title order={3}>State of Mind</Title>
        <Button 
          leftIcon={<IconPlus size={16} />} 
          onClick={() => setIsModalOpen(true)}
        >
          Add Entry
        </Button>
      </Group>
      
      <SegmentedControl
        value={timeRange}
        onChange={(value: TimeRange) => setTimeRange(value)}
        data={[
          { value: '1W', label: '1W' },
          { value: '1M', label: '1M' },
          { value: '3M', label: '3M' },
          { value: '6M', label: '6M' },
          { value: '1Y', label: '1Y' },
        ]}
        fullWidth
      />
      
      <Tabs 
        value={viewMode} 
        onTabChange={(value) => setViewMode(value as ViewMode)}
      >
        <Tabs.List>
          <Tabs.Tab value="chart" icon={<IconChartLine size={14} />}>Chart</Tabs.Tab>
          <Tabs.Tab value="calendar" icon={<IconCalendar size={14} />}>Calendar</Tabs.Tab>
          <Tabs.Tab value="list" icon={<IconList size={14} />}>List</Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="chart" pt="md">
          <Box style={{ height: 300, position: 'relative' }}>
            <Center style={{ height: '100%' }}>
              <Text color="dimmed">Chart view coming soon</Text>
            </Center>
          </Box>
        </Tabs.Panel>
        
        <Tabs.Panel value="calendar" pt="md">
          <Box style={{ minHeight: 300, position: 'relative' }}>
            <Center style={{ height: '100%' }}>
              <Text color="dimmed">Calendar view coming soon</Text>
            </Center>
          </Box>
        </Tabs.Panel>
        
        <Tabs.Panel value="list" pt="md">
          <Stack spacing="sm">
            {filteredEntries.map((entry) => (
              <Card key={entry.id} withBorder p="md">
                <Group position="apart">
                  <Group>
                    {moodOptions.find(m => m.value === entry.mood)?.icon}
                    <Text weight={500}>
                      {moodOptions.find(m => m.value === entry.mood)?.label}
                    </Text>
                    <Text size="sm" color="dimmed">
                      {entry.date.toLocaleDateString()}
                    </Text>
                  </Group>
                  <Group>
                    <Badge 
                      leftSection={energyOptions.find(e => e.value === entry.energy)?.icon}
                      variant="outline"
                      color={energyOptions.find(e => e.value === entry.energy)?.color}
                    >
                      {energyOptions.find(e => e.value === entry.energy)?.label}
                    </Badge>
                    <ActionIcon 
                      color="red" 
                      variant="light"
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
                {entry.note && (
                  <Text size="sm" mt="xs" color="dimmed">
                    {entry.note}
                  </Text>
                )}
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>
      </Tabs>
      
      <Modal 
        opened={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Add State of Mind Entry"
        size="lg"
      >
        <Stack spacing="lg">
          <div>
            <Text size="sm" weight={500} mb="xs">How are you feeling?</Text>
            <SegmentedControl
              value={selectedMood || ''}
              onChange={setSelectedMood}
              data={moodOptions.map(option => ({
                value: option.value,
                label: (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {option.icon}
                    <Text size="xs" mt={4}>{option.label}</Text>
                  </div>
                ),
              }))}
              fullWidth
              size="md"
            />
          </div>
          
          <div>
            <Text size="sm" weight={500} mb="xs">Energy Level</Text>
            <SegmentedControl
              value={selectedEnergy || ''}
              onChange={setSelectedEnergy}
              data={energyOptions.map(option => ({
                value: option.value,
                label: (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {option.icon}
                    <Text size="xs" mt={4}>{option.label}</Text>
                  </div>
                ),
              }))}
              fullWidth
              size="md"
            />
          </div>
          
          <Textarea
            label="Note (Optional)"
            placeholder="Add any notes about how you're feeling..."
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            minRows={3}
          />
          
          <Button 
            onClick={handleAddEntry}
            disabled={!selectedMood || !selectedEnergy}
            fullWidth
          >
            Save Entry
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default StateOfMindTracker;

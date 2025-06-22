import { Title, Container, Tabs, rem } from '@mantine/core';
import { IconBed, IconWalk, IconHeart, IconMeat } from '@tabler/icons-react';
import { AppleHealthImport } from '../features/health/AppleHealthImport';
import { 
  SleepChart, 
  HeartRateChart, 
  NutritionChart, 
  StepsChart
} from '../features/health/charts';

export const HealthPage = () => {
  const iconStyle = { width: rem(16), height: rem(16) };

  return (
    <Container size="xl" p="md">
      <Title order={1} mb="lg">Health Dashboard</Title>
      
      <Tabs defaultValue="sleep" mb="xl">
        <Tabs.List>
          <Tabs.Tab 
            value="sleep" 
            leftSection={<IconBed style={iconStyle} />}
          >
            Sleep
          </Tabs.Tab>
          <Tabs.Tab 
            value="heart" 
            leftSection={<IconHeart style={iconStyle} />}
          >
            Heart Rate
          </Tabs.Tab>
          <Tabs.Tab 
            value="nutrition" 
            leftSection={<IconMeat style={iconStyle} />}
          >
            Nutrition
          </Tabs.Tab>
          <Tabs.Tab 
            value="steps" 
            leftSection={<IconWalk style={iconStyle} />}
          >
            Steps
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="sleep" pt="md">
          <SleepChart />
        </Tabs.Panel>
        <Tabs.Panel value="heart" pt="md">
          <HeartRateChart />
        </Tabs.Panel>
        <Tabs.Panel value="nutrition" pt="md">
          <NutritionChart />
        </Tabs.Panel>
        <Tabs.Panel value="steps" pt="md">
          <StepsChart />
        </Tabs.Panel>
      </Tabs>
      
      <AppleHealthImport />
    </Container>
  );
};

export default HealthPage;

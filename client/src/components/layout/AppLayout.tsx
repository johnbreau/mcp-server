import { AppShell, MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { MantineColorsTuple } from '@mantine/core';
import type { ReactNode } from 'react';

// Define your color scheme
const myColor: MantineColorsTuple = [
  '#e0fbff',
  '#acf0ff',
  '#75e1ff',
  '#47d2ff',
  '#28c7ff',
  '#16c1ff',
  '#00bfff',
  '#00a7e0',
  '#0095c7',
  '#0082ad'
];

const theme = createTheme({
  colors: {
    myColor,
  },
  primaryColor: 'myColor',
});

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <AppShell
        padding="md"
        styles={(theme) => ({
          main: {
            backgroundColor: theme.colors.gray[0],
            '@media (prefers-color-scheme: dark)': {
              backgroundColor: theme.colors.dark[8],
            },
          },
        })}
      >
        {children}
      </AppShell>
    </MantineProvider>
  );
}

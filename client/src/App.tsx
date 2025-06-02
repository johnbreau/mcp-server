import React from 'react';
import { AppShell, Title, Button, MantineProvider } from '@mantine/core';
import type { AppShellProps } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  useLocation, 
  Link as RouterLink 
} from 'react-router-dom';
import { IconSearch, IconList, IconHome, IconRobot } from '@tabler/icons-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Import page components
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import NotesListPage from './pages/NotesListPage';
import NoteViewer from './pages/NoteViewer';
import AIPage from './pages/AIPage';

type CustomAppShellProps = Omit<AppShellProps, 'navbar' | 'header'> & {
  navbar?: Omit<NonNullable<AppShellProps['navbar']>, 'children'> & { children?: React.ReactNode };
  header?: Omit<NonNullable<AppShellProps['header']>, 'children'> & { children?: React.ReactNode };
};

// Custom AppShell component with proper typing
const CustomAppShell: React.FC<CustomAppShellProps> = (props) => {
  return <AppShell {...props} />;
};

type NavLinkProps = {
  to: string;
  icon: React.ReactNode;
  label: string;
};

// NavLink component
const NavLink = ({ to, icon, label }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Button
      component={RouterLink}
      to={to}
      variant={isActive ? 'light' : 'subtle'}
      leftSection={icon}
      fullWidth
      style={{ 
        justifyContent: 'flex-start', 
        marginBottom: '0.25rem',
        textDecoration: 'none'
      }}
    >
      {label}
    </Button>
  );
};

// Navbar component
const Navbar = () => (
  <AppShell.Navbar p="md" style={{ width: 250 }}>
    <AppShell.Section>
      <Title order={4} style={{ padding: '1rem', marginBottom: '1rem' }}>Obsidian Vault</Title>
    </AppShell.Section>
    <AppShell.Section grow>
      <NavLink to="/" icon={<IconHome size={16} />} label="Home" />
      <NavLink to="/search" icon={<IconSearch size={16} />} label="Search" />
      <NavLink to="/notes" icon={<IconList size={16} />} label="Browse Notes" />
      <NavLink to="/ai" icon={<IconRobot size={16} />} label="AI Assistant" />
    </AppShell.Section>
  </AppShell.Navbar>
);

// Header component
const Header = () => (
  <AppShell.Header style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
    <Title order={3} style={{ margin: 0 }}>Obsidian Vault Explorer</Title>
  </AppShell.Header>
);

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications position="top-right" />
        <Router>
          <CustomAppShell
            padding="md"
            navbar={{
              width: 250,
              breakpoint: 'sm',
              children: <Navbar />
            }}
            header={{
              height: 60,
              children: <Header />
            }}
            styles={{
              main: {
                backgroundColor: 'var(--mantine-color-gray-0)',
                '@media (prefers-color-scheme: dark)': {
                  backgroundColor: 'var(--mantine-color-dark-8)',
                }
              }
            }}
          >
            <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', height: '100%', padding: '1rem' }}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/ai" element={<AIPage />} />
                <Route path="/notes">
                  <Route index element={<NotesListPage />} />
                  <Route path=":path/*" element={<NoteViewer />} />
                </Route>
                <Route path="*" element={
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <Title order={2}>404 - Page Not Found</Title>
                    <Button component="a" href="/" mt="md">Go to Home</Button>
                  </div>
                } />
              </Routes>
            </div>
          </CustomAppShell>
        </Router>
        <ReactQueryDevtools initialIsOpen={false} />
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default App;

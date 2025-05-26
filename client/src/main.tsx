import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme, Text } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import './index.css';
import App from './App';

const theme = createTheme({
  /** Put your theme overrides here */
  fontFamily: 'Inter, sans-serif',
});

// Check if the root element exists
const rootElement = document.getElementById('root');

if (!rootElement) {
  // If root element doesn't exist, create it and append to body
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
  
  // Render error message
  createRoot(newRoot).render(
    <MantineProvider theme={theme}>
      <div style={{ padding: '2rem' }}>
        <Text size="xl" fw={500} c="red">
          Error: Root element was not found. A new root element has been created.
        </Text>
      </div>
    </MantineProvider>
  );
  
  console.error('Root element not found. A new root element has been created.');
} else {
  // Root element exists, render the app normally
  try {
    createRoot(rootElement).render(
      <React.StrictMode>
        <MantineProvider theme={theme}>
          <Notifications position="top-right" />
          <App />
        </MantineProvider>
      </React.StrictMode>
    );
  } catch (error) {
    // Handle any errors during rendering
    console.error('Failed to render the app:', error);
    
    // Render error message
    createRoot(rootElement).render(
      <MantineProvider theme={theme}>
        <div style={{ padding: '2rem' }}>
          <Text size="xl" fw={500} c="red">
            Error: Failed to load the application. Please check the console for details.
          </Text>
        </div>
      </MantineProvider>
    );
  }
}

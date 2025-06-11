console.log('main.tsx: Starting application...');

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
// Import Mantine styles first
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

// Import global styles (SCSS)
import './styles/global.scss';
import App from './App';

// Create a simple theme
const theme = createTheme({
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  primaryColor: 'blue',
  defaultRadius: 'md',
});

console.log('main.tsx: Imports completed');

console.log('main.tsx: Checking for root element');

// Check if the root element exists
const rootElement = document.getElementById('root');
console.log('main.tsx: Root element:', rootElement);

if (!rootElement) {
  console.error('main.tsx: Failed to find the root element');
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.style.padding = '20px';
  errorDiv.style.fontFamily = 'Arial, sans-serif';
  errorDiv.innerHTML = `
    <h1>Error: Root element not found</h1>
    <p>Could not find an element with id 'root' in the HTML.</p>
    <p>Please make sure your index.html file contains a div with id="root".</p>
  `;
  document.body.appendChild(errorDiv);
} else {
  // Root element exists, render the app normally
  try {
    console.log('main.tsx: Rendering application...');
    const root = createRoot(rootElement);
    console.log('main.tsx: Root created, rendering App component');
    
    // Create a temporary app to ensure Mantine is properly initialized
    const TempApp = () => (
      <MantineProvider 
        theme={theme}
        defaultColorScheme="light"
      >
        <Notifications position="top-right" />
        <React.StrictMode>
          <App />
        </React.StrictMode>
      </MantineProvider>
    );
    
    root.render(<TempApp />);
    console.log('main.tsx: Render completed');
  } catch (error) {
    // Handle any errors during rendering
    console.error('main.tsx: Error rendering application:', error);
    
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.style.padding = '20px';
    errorDiv.style.fontFamily = 'Arial, sans-serif';
    errorDiv.innerHTML = `
      <h1>Error: Application failed to render</h1>
      <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      <p>Check the browser console for more details.</p>
    `;
    
    // Clear any existing content in the root
    if (rootElement) {
      rootElement.innerHTML = '';
      rootElement.appendChild(errorDiv);
    } else {
      document.body.appendChild(errorDiv);
    }
  }
}

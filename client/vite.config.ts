import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Disable HMR for now
    hmr: false,
    // Force WebSocket to use the same port as the server
    strictPort: true,
    // Configure CORS
    cors: true,
    // Proxy API requests to the backend
    proxy: {
      '/tools': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (_, req) => {
            console.log('Sending Request to:', {
              method: req.method,
              url: req.url,
              headers: req.headers,
            });
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Received Response:', {
              statusCode: proxyRes.statusCode,
              url: req.url,
            });
          });
        }
      },
    },
  },
  define: {
    global: 'globalThis',
  },
})

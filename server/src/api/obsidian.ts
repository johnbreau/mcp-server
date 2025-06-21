// Simple mock for the obsidian API
export const api = {
  // Add any required mock methods here
  search: async () => ({
    results: []
  }),
  readNote: async () => ({
    content: ''
  })
};

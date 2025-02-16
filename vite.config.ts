import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['/tests/integration/dataprompt_server_test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: [],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

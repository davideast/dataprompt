import { mcpPlugin } from './dist/plugins/mcp.js';

/** @type {import('./src/core/interfaces').DatapromptConfig} */
export default {
  plugins: [
    mcpPlugin({
      url: 'http://localhost:3000/mcp', // Default MCP server URL
    }),
  ],
};
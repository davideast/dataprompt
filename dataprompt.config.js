import { mcpPlugin } from './dist/plugins/mcp.js';

/** @type {import('./src/types').DatapromptConfig} */
export default {
  plugins: [mcpPlugin()],
};
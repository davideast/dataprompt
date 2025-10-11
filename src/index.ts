// Export runtime values
export { dataprompt, createPromptServer } from './core/dataprompt.js';
export { RequestContextSchema } from './core/interfaces.js';

// Export type-only interfaces and types
export type { DatapromptRoute } from './routing/server.js';
export type { DatapromptConfig, DatapromptUserConfig } from './core/config.js';
export type {
  RequestContext,
  DatapromptPlugin,
  DataSourceProvider,
  DataActionProvider,
  TriggerConfig,
  TriggerProvider,
} from './core/interfaces.js';
export type {
  McpTool,
  McpResource,
  McpPrompt,
  McpFunction,
} from './core/mcp.js';
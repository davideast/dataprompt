import { McpTool, McpResource, McpPrompt } from '../../core/mcp.js';
import {
  DataSourceProvider,
  DataActionProvider,
  DatapromptPlugin,
} from '../../core/interfaces.js';

/**
 * Creates a generic MCP provider that can function as both a data source
 * and a data action. This is the core of the dynamic provider registration.
 * @param name The name of the provider (e.g., 'weather').
 * @param entity The MCP entity (Tool, Resource, or Prompt) to wrap.
 * @returns A provider that can be used by the PluginManager.
 */
function createMcpProvider(name: string, entity: McpTool | McpResource | McpPrompt): DataSourceProvider & DataActionProvider {
  return {
    name,
    // The fetchData method is used when the provider is called in the `sources` block.
    async fetchData({ config }) {
      // The first key in the config object is the function name (e.g., 'get').
      const functionName = Object.keys(config)[0];
      const params = config[functionName];
      const func = (entity as McpTool)[functionName];

      if (typeof func !== 'function') {
        throw new Error(`MCP Error: Function '${functionName}' not found on provider '${name}'.`);
      }
      return await func(params);
    },
    // The execute method is used when the provider is called in the `result` block.
    async execute({ config }) {
      const functionName = Object.keys(config)[0];
      const params = config[functionName];
      const func = (entity as McpTool)[functionName];

      if (typeof func !== 'function') {
        throw new Error(`MCP Error: Function '${functionName}' not found on provider '${name}'.`);
      }
      await func(params);
    },
  };
}

/**
 * The MCP plugin itself. This plugin doesn't do much on its own, but it
 * provides the `createMcpProvider` function that is used by the McpRegistry
 * to dynamically create and register providers.
 */
export function mcpPlugin(): DatapromptPlugin {
  return {
    name: 'mcp',
    // This plugin doesn't have a single, static provider to create.
    // Instead, providers are created dynamically via the McpRegistry.
    // We're including this function to satisfy the plugin interface.
    createMcpProvider,
  };
}
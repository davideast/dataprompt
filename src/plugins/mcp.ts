import {
  DatapromptPlugin,
  DataSourceProvider,
  DataActionProvider,
  FetchDataParams,
  ExecuteParams,
} from '../core/interfaces.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

// Define the configuration for the MCP plugin
export const McpPluginConfigSchema = z.object({
  url: z.string().url(),
});

type McpPluginConfig = z.infer<typeof McpPluginConfigSchema>;

// A simple client manager to cache clients by URL
const clientManager = {
  clients: new Map<string, Client>(),

  async getClient(url: string): Promise<Client> {
    if (!this.clients.has(url)) {
      const client = new Client({
        name: 'dataprompt-mcp-client',
        version: '1.0.0',
      });
      const transport = new StreamableHTTPClientTransport(new URL(url));
      await client.connect(transport);
      this.clients.set(url, client);
    }
    return this.clients.get(url)!;
  },
};

// Implement the MCP data source provider
class McpDataSourceProvider implements DataSourceProvider {
  name = 'mcp';

  constructor(private config: McpPluginConfig) {}

  async fetchData(params: FetchDataParams): Promise<Record<string, any>> {
    const client = await clientManager.getClient(this.config.url);
    const data: Record<string, any> = {};

    if (params.config.resources) {
      for (const key in params.config.resources) {
        const resourceParams = params.config.resources[key];
        data[key] = await client.readResource(resourceParams);
      }
    }

    if (params.config.tools) {
      for (const key in params.config.tools) {
        const toolParams = params.config.tools[key];
        data[key] = await client.callTool(toolParams);
      }
    }

    if (params.config.prompts) {
      for (const key in params.config.prompts) {
        const promptParams = params.config.prompts[key];
        data[key] = await client.getPrompt(promptParams);
      }
    }

    return data;
  }
}

// Implement the MCP data action provider
class McpDataActionProvider implements DataActionProvider {
  name = 'mcp';

  constructor(private config: McpPluginConfig) {}

  async execute(params: ExecuteParams): Promise<void> {
    const client = await clientManager.getClient(this.config.url);

    if (params.config.tools) {
      for (const toolParams of params.config.tools) {
        await client.callTool(toolParams);
      }
    }

    if (params.config.prompts) {
      for (const promptParams of params.config.prompts) {
        await client.getPrompt(promptParams);
      }
    }
  }
}

// Create the MCP plugin
export function mcpPlugin(config: McpPluginConfig): DatapromptPlugin {
  const validatedConfig = McpPluginConfigSchema.parse(config);

  return {
    name: 'mcp',
    createDataSource() {
      return new McpDataSourceProvider(validatedConfig);
    },
    createDataAction() {
      return new McpDataActionProvider(validatedConfig);
    },
  };
}
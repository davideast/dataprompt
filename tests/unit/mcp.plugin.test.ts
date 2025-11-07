import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mcpPlugin } from '../../src/plugins/mcp.js';
import {
  DatapromptPlugin,
  DataSourceProvider,
  DataActionProvider,
  FetchDataParams,
  ExecuteParams,
} from '../../src/core/interfaces.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Mock the MCP client
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  const mockClient = {
    connect: vi.fn(),
    readResource: vi.fn(),
    callTool: vi.fn(),
    getPrompt: vi.fn(),
  };
  return {
    Client: vi.fn(() => mockClient),
  };
});

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  return {
    StreamableHTTPClientTransport: vi.fn(),
  };
});

describe('mcpPlugin', () => {
  let mockMcpClient: Client;

  beforeEach(() => {
    mockMcpClient = new Client({
      name: 'test-client',
      version: '1.0.0',
    });
    vi.clearAllMocks();
  });

  it('should create a valid plugin object', () => {
    const plugin = mcpPlugin({ url: 'http://localhost:3000/mcp' });
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('mcp');
    expect(plugin.createDataSource).toBeInstanceOf(Function);
    expect(plugin.createDataAction).toBeInstanceOf(Function);
  });

  describe('DataSourceProvider', () => {
    it('should fetch data for resources, tools, and prompts', async () => {
      const plugin = mcpPlugin({ url: 'http://localhost:3000/mcp' });
      const dataSource = plugin.createDataSource() as DataSourceProvider;

      const params: FetchDataParams = {
        config: {
          resources: {
            myResource: { uri: 'resource-a' },
          },
          tools: {
            myTool: { name: 'tool-a' },
          },
          prompts: {
            myPrompt: { name: 'prompt-a' },
          },
        },
        request: { url: '/test' },
        file: {
          name: 'test.prompt',
          path: 'prompts/test.prompt',
          route: '/test',
          content: '',
          frontmatter: {},
        },
      };

      await dataSource.fetchData(params);

      expect(mockMcpClient.readResource).toHaveBeenCalledWith({
        uri: 'resource-a',
      });
      expect(mockMcpClient.callTool).toHaveBeenCalledWith({ name: 'tool-a' });
      expect(mockMcpClient.getPrompt).toHaveBeenCalledWith({
        name: 'prompt-a',
      });
    });
  });

  describe('DataActionProvider', () => {
    it('should execute actions for tools and prompts', async () => {
      const plugin = mcpPlugin({ url: 'http://localhost:3000/mcp' });
      const dataAction = plugin.createDataAction() as DataActionProvider;

      const params: ExecuteParams = {
        config: {
          tools: [{ name: 'tool-b' }],
          prompts: [{ name: 'prompt-b' }],
        },
        promptSources: { output: 'test output' },
        request: { url: '/test' },
        file: {
          name: 'test.prompt',
          path: 'prompts/test.prompt',
          route: '/test',
          content: '',
          frontmatter: {},
        },
      };

      await dataAction.execute(params);

      expect(mockMcpClient.callTool).toHaveBeenCalledWith({ name: 'tool-b' });
      expect(mockMcpClient.getPrompt).toHaveBeenCalledWith({
        name: 'prompt-b',
      });
    });
  });
});
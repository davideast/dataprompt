import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mcpPlugin } from '../../src/plugins/mcp.js';
import { createMockMcpServer } from './mcp-server.mock.js';
import http from 'http';
import {
  DataSourceProvider,
  DataActionProvider,
  FetchDataParams,
  ExecuteParams,
} from '../../src/core/interfaces.js';

describe('mcpPlugin direct integration test', () => {
  let server: http.Server;
  let dataSource: DataSourceProvider;
  let dataAction: DataActionProvider;

  beforeAll(async () => {
    server = await createMockMcpServer();
    const plugin = mcpPlugin({ url: 'http://localhost:3002/mcp' });
    dataSource = plugin.createDataSource() as DataSourceProvider;
    dataAction = plugin.createDataAction() as DataActionProvider;
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => {
        console.log('Mock MCP Server closed');
        resolve();
      });
    });
  });

  it('should fetch data from the mock MCP server', async () => {
    const params: FetchDataParams = {
      config: {
        tools: {
          testTool: { name: 'test-tool', arguments: { input: 'test-input' } },
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

    const result = await dataSource.fetchData(params);

    expect(result.testTool.structuredContent.output).toBe(
      'test-tool-output-for-test-input'
    );
  });

  it('should execute actions on the mock MCP server', async () => {
    const params: ExecuteParams = {
      config: {
        tools: [
          { name: 'test-tool', arguments: { input: 'test-execute-input' } },
        ],
      },
      promptSources: {},
      request: { url: '/test' },
      file: {
        name: 'test.prompt',
        path: 'prompts/test.prompt',
        route: '/test',
        content: '',
        frontmatter: {},
      },
    };

    await expect(dataAction.execute(params)).resolves.toBeUndefined();
  });
});
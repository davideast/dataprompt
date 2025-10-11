import { describe, it, expect, vi } from 'vitest';
import { mcpPlugin } from '../../src/plugins/mcp.js';
import {
  DatapromptPlugin,
  DataSourceProvider,
  DataActionProvider,
  FetchDataParams,
  ExecuteParams,
} from '../../src/core/interfaces.js';

describe('mcpPlugin', () => {
  it('should create a valid plugin object', () => {
    const plugin = mcpPlugin();
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('mcp');
    expect(plugin.createDataSource).toBeInstanceOf(Function);
    expect(plugin.createDataAction).toBeInstanceOf(Function);
  });

  describe('DataSourceProvider', () => {
    const plugin = mcpPlugin();
    const dataSource = plugin.createDataSource() as DataSourceProvider;

    it('should fetch data for resources, tools, and prompts', async () => {
      const params: FetchDataParams = {
        config: {
          resources: {
            myResource: { name: 'resource-a' },
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

      const data = await dataSource.fetchData(params);

      expect(data.myResource).toBeDefined();
      expect(data.myResource.content).toContain('resource-a');
      expect(data.myTool).toBeDefined();
      expect(data.myTool.result).toContain('tool-a');
      expect(data.myPrompt).toBeDefined();
      expect(data.myPrompt.response).toContain('prompt-a');
    });
  });

  describe('DataActionProvider', () => {
    const plugin = mcpPlugin();
    const dataAction = plugin.createDataAction() as DataActionProvider;

    it('should execute actions for tools and prompts', async () => {
      const executeToolSpy = vi.spyOn(
        (dataAction as any),
        '_useTool'
      );
      const executePromptSpy = vi.spyOn(
        (dataAction as any),
        '_runPrompt'
      );

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

      expect(executeToolSpy).toHaveBeenCalledWith(
        { name: 'tool-b' },
        { output: 'test output' }
      );
      expect(executePromptSpy).toHaveBeenCalledWith(
        { name: 'prompt-b' },
        { output: 'test output' }
      );
    });
  });
});
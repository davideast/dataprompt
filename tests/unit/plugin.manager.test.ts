// tests/unit/plugin.manager.test.ts
import { describe, it, expect } from 'vitest';
import { PluginManager } from '../../src/core/plugin.manager.js';
import { DatapromptConfig } from '../../src/core/config.js';
import { DatapromptPlugin } from '../../src/core/interfaces.js';
import { getDefaultPlugins } from '../../src/core/default-plugins.js';

describe('PluginManager', () => {
  it('should register provided plugins', () => {
    const mockConfig: DatapromptConfig = {
      rootDir: '/mock',
      promptsDir: '/mock/prompts',
      schemaFile: '/mock/schema.ts',
      secrets: {},
      plugins: getDefaultPlugins()
    };

    const manager = new PluginManager(mockConfig);
    const dataSources = manager.getDataSources();
    const actions = manager.getActions();

    expect(dataSources.map(ds => ds.name)).toEqual(expect.arrayContaining(['fetch', 'firestore']));
    expect(actions.map(a => a.name)).toEqual(expect.arrayContaining(['firestore']));
  });

  it('should register user-provided plugins alongside others', () => {
    const userPlugin: DatapromptPlugin = {
      name: 'custom-plugin',
      createDataSource: () => ({ name: 'custom-source', fetchData: async () => ({}) }),
      createDataAction: () => ({ name: 'custom-action', execute: async () => {} })
    };

    const mockConfig: DatapromptConfig = {
      rootDir: '/mock',
      promptsDir: '/mock/prompts',
      schemaFile: '/mock/schema.ts',
      secrets: {},
      plugins: [userPlugin, ...getDefaultPlugins()]
    };

    const manager = new PluginManager(mockConfig);
    const dataSources = manager.getDataSources();
    const actions = manager.getActions();

    expect(dataSources.map(ds => ds.name)).toContain('custom-source');
    expect(actions.map(a => a.name)).toContain('custom-action');
    // Ensure defaults are still present
    expect(dataSources.map(ds => ds.name)).toContain('fetch');
  });
});

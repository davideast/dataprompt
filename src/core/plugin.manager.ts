import { DatapromptConfig } from './config.js';
import { DatapromptPlugin, DataActionProvider, DataSourceProvider, TriggerProvider } from './interfaces.js';
import { firestorePlugin } from '../plugins/firebase/public.js';
import { schedulerPlugin } from '../plugins/scheduler/index.js';
import { fetchPlugin } from '../plugins/fetch/index.js';
import { mcpPlugin } from '../plugins/mcp/index.js';
import { McpPrompt, McpResource, McpTool } from './mcp.js';

export class PluginManager {
  #dataSources = new Map<string, DataSourceProvider>();
  #actions = new Map<string, DataActionProvider>();
  #triggers = new Map<string, TriggerProvider>();
  #mcpPlugin: ReturnType<typeof mcpPlugin>;

  constructor(config: DatapromptConfig) {
    const allPlugins = this.#resolvePlugins(config.plugins);
    
    for (const plugin of allPlugins) {
      this.#registerPlugin(plugin);
    }
    // Find and store the mcpPlugin instance for later use.
    const mcp = allPlugins.find(p => p.name === 'mcp');
    if (!mcp || !mcp.createMcpProvider) {
      throw new Error('MCP plugin failed to load.');
    }
    this.#mcpPlugin = mcp as ReturnType<typeof mcpPlugin>;
  }

  #registerPlugin(plugin: DatapromptPlugin): void {
    if (plugin.createDataSource) {
      const dataSourceProvider = plugin.createDataSource();
      this.#dataSources.set(dataSourceProvider.name, dataSourceProvider);
    }
    if (plugin.createDataAction) {
      const dataActionProvider = plugin.createDataAction();
      this.#actions.set(dataActionProvider.name, dataActionProvider);
    }
    if (plugin.createTrigger) {
      const triggerProvider = plugin.createTrigger();
      this.#triggers.set(triggerProvider.name, triggerProvider);
    }
  }

  /**
   * Dynamically registers a new provider for an MCP entity.
   * This is called by the McpRegistry when a new tool, resource, or prompt is registered.
   * It uses the createMcpProvider function from the mcpPlugin to create a new
   * generic provider and registers it as both a data source and an action.
   * @param name The name of the provider (e.g., 'weather').
   * @param entity The MCP entity (Tool, Resource, or Prompt).
   */
  registerMcpProvider(name: string, entity: McpTool | McpResource | McpPrompt) {
    if (!this.#mcpPlugin?.createMcpProvider) {
      throw new Error('MCP plugin is not properly initialized or is missing createMcpProvider.');
    }
    const provider = this.#mcpPlugin.createMcpProvider(name, entity);
    this.#dataSources.set(name, provider);
    this.#actions.set(name, provider);
  }
  
  #resolvePlugins = (userPlugins: DatapromptPlugin[] = []): DatapromptPlugin[] => {
    const plugins = [...userPlugins];
    if (!plugins.some(p => p.name === 'firestore')) plugins.push(firestorePlugin());
    if (!plugins.some(p => p.name === 'fetch')) plugins.push(fetchPlugin());
    if (!plugins.some(p => p.name === 'schedule')) plugins.push(schedulerPlugin());
    // Ensure the MCP plugin is always loaded.
    if (!plugins.some(p => p.name === 'mcp')) plugins.push(mcpPlugin());
    return plugins;
  }

  public getDataSource(name: string): DataSourceProvider {
    const provider = this.#dataSources.get(name);
    if (!provider) {
      throw new Error(`Data source provider "${name}" not registered. Available: ${[...this.#dataSources.keys()].join(', ')}`);
    }
    return provider;
  }

  public getAction(name: string): DataActionProvider {
    const provider = this.#actions.get(name);
    if (!provider) {
      throw new Error(`Data action provider "${name}" not registered. Available: ${[...this.#actions.keys()].join(', ')}`);
    }
    return provider;
  }

  public getTrigger(name: string): TriggerProvider {
    const provider = this.#triggers.get(name);
    if (!provider) {
      throw new Error(`Trigger provider "${name}" not registered. Available: ${[...this.#triggers.keys()].join(', ')}`);
    }
    return provider;
  }

  public getDataSources(): DataSourceProvider[] {
    return Array.from(this.#dataSources.values());
  }

  public getActions(): DataActionProvider[] {
    return Array.from(this.#actions.values());
  }
}
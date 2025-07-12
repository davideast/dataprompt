import { DatapromptConfig } from './config.js';
import { DatapromptPlugin, DataActionProvider, DataSourceProvider, TriggerProvider } from './interfaces.js';
import { firestorePlugin } from '../plugins/firebase/public.js';
import { schedulerPlugin } from '../plugins/scheduler/index.js';
import { fetchPlugin } from '../plugins/fetch/index.js';

export class PluginManager {
  #dataSources = new Map<string, DataSourceProvider>();
  #actions = new Map<string, DataActionProvider>();
  #triggers = new Map<string, TriggerProvider>(); // Added map for triggers

  constructor(config: DatapromptConfig) {
    const allPlugins = this.#resolvePlugins(config.plugins);
    
    for (const plugin of allPlugins) {
      this.#registerPlugin(plugin);
    }
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
  
  #resolvePlugins = (userPlugins: DatapromptPlugin[] = []): DatapromptPlugin[] => {
    const plugins = [...userPlugins];
    if (!plugins.some(p => p.name === 'firestore')) plugins.push(firestorePlugin());
    if (!plugins.some(p => p.name === 'fetch')) plugins.push(fetchPlugin());
    if (!plugins.some(p => p.name === 'schedule')) plugins.push(schedulerPlugin());
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

  /**
   * NEW: Retrieves a trigger provider by its registered name.
   * @param name The name of the trigger provider (e.g., 'schedule').
   */
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
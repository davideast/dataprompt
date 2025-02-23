import { 
  DataSourceProvider, 
  DataActionProvider, 
  TriggerProvider, 
  DatapromptPlugin,
} from './interfaces.js';
import { firestorePlugin } from '../plugins/firebase/public.js';
import { schedulerPlugin } from '../plugins/scheduler/index.js';
import { fetchPlugin } from '../plugins/fetch/index.js';

export class PluginRegistry {
  #plugins = new Map<string, DatapromptPlugin>();
  #dataSources = new Map<string, DataSourceProvider>();
  #actions = new Map<string, DataActionProvider>();
  #triggers = new Map<string, TriggerProvider>();

  register(plugin: DatapromptPlugin): this;
  register(plugins: DatapromptPlugin[]): this;
  register(pluginOrPlugins: DatapromptPlugin | DatapromptPlugin[]): this {
    if (Array.isArray(pluginOrPlugins)) {
      return this.registerMany(pluginOrPlugins);
    }
    return this.registerOne(pluginOrPlugins);
  }

  registerMany(plugins: DatapromptPlugin[] = []) {
    for (const plugin of plugins) {
      this.registerOne(plugin);
    }
    return this;
  }

  registerOne(plugin: DatapromptPlugin) {
    if (plugin.createDataSource) {
      this.registerDataSource(plugin.createDataSource());
    }
    if (plugin.createDataAction) {
      this.registerAction(plugin.createDataAction());
    }
    if(plugin.createTrigger) {
      this.registerTrigger(plugin.createTrigger());
    }
    this.#plugins.set(plugin.name, plugin);
    return this;
  }

  registerDataSource(provider: DataSourceProvider) {
    this.#dataSources.set(provider.name, provider);
    return this;
  }

  registerAction(provider: DataActionProvider) {
    this.#actions.set(provider.name, provider);
    return this;
  }

  getDataSource(name: string) {
    const provider = this.#dataSources.get(name);
    if (!provider) {
      throw new Error(`Data source "${name}" not registered`);
    }
    return provider;
  }

  getAction(name: string) {
    const provider = this.#actions.get(name);
    if (!provider) {
      throw new Error(`Action "${name}" not registered`);
    }
    return provider;
  }

  registerTrigger(provider: TriggerProvider) {
    this.#triggers.set(provider.name, provider);
    return this;
  }

  getTrigger(name: string) {
    const provider = this.#triggers.get(name);
    if (!provider) {
      throw new Error(`Trigger "${name}" not registered`);
    }
    return provider.createTrigger();
  }

  get dataSources() {
    return Array.from(this.#dataSources.keys());
  }

  get actions() {
    return Array.from(this.#actions.keys());
  }
}

export function createPluginRegistry(plugins: DatapromptPlugin[] = []) {
  const registry = new PluginRegistry();
  const pluginsToRegister = [
    ...plugins,
  ];

  const hasOwnFirestore = pluginsToRegister.some(plugin => plugin.name === 'firestore');
  const hasOwnFetch = pluginsToRegister.some(plugin => plugin.name === 'fetch');
  const hasOwnScheduler = pluginsToRegister.some(plugin => plugin.name === 'schedule');
  
  if (!hasOwnFirestore) {
    pluginsToRegister.push(firestorePlugin({
      secrets: {
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      }
    }));
  }
  if (!hasOwnFetch) {
    pluginsToRegister.push(fetchPlugin());
  }
  if (!hasOwnScheduler) {
    pluginsToRegister.push(schedulerPlugin());
  }

  registry.registerMany(pluginsToRegister);
  return registry;
}

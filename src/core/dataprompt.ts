import { Genkit } from 'genkit';
import { RequestContext } from './interfaces.js';
import { PluginManager } from './plugin.manager.js';
import { createRouteCatalog } from '../routing/index.js';
import { createApiServer } from '../routing/server.js';
import { SchemaMap, registerUserSchemas } from '../utils/schema-loader.js';
import { RouteManager, createRouteManager } from '../routing/route-manager.js';
import { FlowManager, createFlowManager } from '../routing/flow-manager.js';
import { TaskManager, createTaskManager } from '../routing/task-manager.js';
import { DatapromptConfig, DatapromptUserConfig } from './config.js'
import { ConfigManager } from './config.manager.js';
import { getLogManager } from '../utils/logging.js';
import { createDefaultGenkit, loadUserGenkitInstance } from './genkit-factory.js';

export interface DatapromptStore {
  generate<Output = any>(url: string | Request | RequestContext): Promise<Output>;
  registry: PluginManager;
  routes: RouteManager;
  flows: FlowManager;
  tasks: TaskManager;
  ai: Genkit;
  userSchemas: SchemaMap;
}

function mergeConfigs(base: DatapromptConfig, override?: DatapromptUserConfig): DatapromptConfig {
  if (!override) {
    return { ...base, secrets: { ...base.secrets }, plugins: [...base.plugins], genkitPlugins: [...base.genkitPlugins] };
  }
  const merged = { ...base, secrets: { ...base.secrets }, plugins: [...base.plugins], genkitPlugins: [...base.genkitPlugins] };
  if (override.rootDir) merged.rootDir = override.rootDir;
  if (override.promptsDir) merged.promptsDir = override.promptsDir;
  if (override.schemaFile) merged.schemaFile = override.schemaFile;
  if (override.secrets) Object.assign(merged.secrets, override.secrets);
  if (override.plugins) merged.plugins.push(...override.plugins);
  if (override.logLevel) merged.logLevel = override.logLevel;
  if (override.genkitPlugins) merged.genkitPlugins.push(...override.genkitPlugins);
  return merged;
}

export async function dataprompt(
  programmaticConfig?: DatapromptUserConfig
): Promise<DatapromptStore> {
  const configManager = new ConfigManager();
  const fileConfig = await configManager.load();
  const config = mergeConfigs(fileConfig, programmaticConfig);
  if (config.logLevel) {
    getLogManager().system.setLevel(config.logLevel);
  }
  const userGenkit = programmaticConfig?.genkit
    ?? await loadUserGenkitInstance(config.rootDir);
  const ai = userGenkit || createDefaultGenkit(config);
  const pluginManager = new PluginManager(config);
  const userSchemas = await registerUserSchemas({
    genkit: ai,
    schemaFile: config.schemaFile,
    rootDir: config.rootDir
  });
  const catalog = await createRouteCatalog({
    promptDir: config.promptsDir,
    ai,
    pluginManager,
    userSchemas,
    rootDir: config.rootDir,
  });

  const routeManager = createRouteManager(catalog);
  const flowManager = createFlowManager(routeManager);
  const taskManager = createTaskManager(catalog.tasks);

  return {
    async generate<Output>(url: string | Request | RequestContext) {
      // The generate method uses the RouteManager to find the route
      // and then directly calls the universal helper to create the context.
      const { route, request: reqFromManager } = await routeManager.getRequest(url);
      if (!route) {
        throw new Error(`No route found for ${typeof url === 'string' ? url : url.url}`);
      }

      // The RouteManager's getRequest handles context creation.
      // We just need to call the flow with the context it provides.
      return route.flow({ request: reqFromManager }) as Output;
    },
    routes: routeManager,
    flows: flowManager,
    tasks: taskManager,
    registry: pluginManager,
    ai,
    userSchemas,
  };
}

export async function createPromptServer(options: {
  config?: DatapromptUserConfig;
  startTasks?: boolean;
} = { startTasks: true }) {
  const { config, startTasks } = options;
  const store = await dataprompt(config);
  const { app, listen } = await createApiServer({ store, startTasks });
  return { store, app, listen, server: app };
}

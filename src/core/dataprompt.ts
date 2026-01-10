import { Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { RequestContext } from './interfaces.js';
import { PluginManager } from './plugin.manager.js';
import { createRouteCatalog } from '../routing/index.js';
import { createApiServer } from '../routing/server.js';
import { SchemaMap, registerUserSchemas } from '../utils/schema-loader.js';
import { RouteManager, createRouteManager } from '../routing/route-manager.js';
import { FlowManager, createFlowManager } from '../routing/flow-manager.js';
import { TaskManager, createTaskManager } from '../routing/task-manager.js';
import { dateFormat } from '../utils/helpers/date-format.js';
import { findUp } from 'find-up';
import { pathToFileURL } from 'node:url';
import { DatapromptConfig, DatapromptUserConfig } from './config.js'
import { ConfigManager } from './config.manager.js';
import { getLogManager } from '../utils/logging.js';

export interface DatapromptStore {
  generate<Output = any>(url: string | Request | RequestContext): Promise<Output>;
  registry: PluginManager;
  routes: RouteManager;
  flows: FlowManager;
  tasks: TaskManager;
  ai: Genkit;
  userSchemas: SchemaMap;
}

function createDefaultGenkit(config: DatapromptConfig): Genkit {
  const plugins: any[] = [];
  const googleApiKey = config.secrets?.GOOGLEAI_API_KEY || config.secrets?.GEMINI_API_KEY;

  if (config.genkitPlugins) {
    plugins.push(...config.genkitPlugins);
  }

  for (const plugin of config.plugins) {
    if (plugin.provideGenkitPlugins) {
      plugins.push(...plugin.provideGenkitPlugins());
    }
  }

  // If no plugins are provided, or if we have a Google API key,
  // we try to add Google AI support.
  // We prioritize user provided plugins, but also support Google AI if key is present.
  if (googleApiKey) {
    // We can't easily check if googleAI is already in plugins because they are instances.
    // However, Genkit supports multiple plugins.
    plugins.push(googleAI({ apiKey: googleApiKey }));
  }

  if (plugins.length === 0) {
    throw new Error('FATAL: No Genkit plugins configured and GOOGLEAI_API_KEY/GEMINI_API_KEY not found.');
  }

  const ai = new Genkit({ plugins });
  ai.defineHelper('dateFormat', dateFormat);
  return ai;
}

async function loadUserGenkitInstance(rootDir: string): Promise<Genkit | undefined> {
  const configPath = await findUp(['dataprompt.config.ts', 'dataprompt.config.js'], { cwd: rootDir });
  if (configPath) {
    try {
      const userModule = await import(pathToFileURL(configPath).toString());
      if (userModule.default?.genkit && userModule.default.genkit instanceof Genkit) {
        return userModule.default.genkit;
      }
    } catch (e) {
      getLogManager().system.warn(`Warning: Could not dynamically import user's genkit instance from ${configPath}.`, e);
    }
  }
  return undefined;
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

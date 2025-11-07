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
import { DatapromptConfig, DatapromptUserConfig } from './config.js';
import { ConfigManager } from './config.manager.js';
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
  const apiKey = config.secrets?.GOOGLEAI_API_KEY;
  if (!apiKey) {
    throw new Error('FATAL: GOOGLEAI_API_KEY not found for default Genkit initialization.');
  }
  const ai = new Genkit({
    plugins: [googleAI({ apiKey })],
  });
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
      console.warn(`Warning: Could not dynamically import user's genkit instance from ${configPath}.`, e);
    }
  }
  return undefined;
}

function mergeConfigs(base: DatapromptConfig, override?: DatapromptUserConfig): DatapromptConfig {
  if (!override) {
    return { ...base, secrets: { ...base.secrets }, plugins: [...base.plugins] };
  }
  const merged = { ...base, secrets: { ...base.secrets }, plugins: [...base.plugins] };
  if (override.rootDir) merged.rootDir = override.rootDir;
  if (override.promptsDir) merged.promptsDir = override.promptsDir;
  if (override.schemaFile) merged.schemaFile = override.schemaFile;
  if (override.secrets) Object.assign(merged.secrets, override.secrets);
  if (override.plugins) merged.plugins.push(...override.plugins);
  return merged;
}

export async function dataprompt(
  programmaticConfig?: DatapromptUserConfig
): Promise<DatapromptStore> {
  const configManager = new ConfigManager();
  const fileConfig = await configManager.load();
  const config = mergeConfigs(fileConfig, programmaticConfig);
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
      const { route, request: reqFromManager } = await routeManager.getRequest(url);
      if (!route) {
        throw new Error(`No route found for ${typeof url === 'string' ? url : url.url}`);
      }
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
  const server = await createApiServer({ store, startTasks });
  return { store, server };
}
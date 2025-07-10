import { GenkitBeta as Genkit } from 'genkit/beta';
import { googleAI } from '@genkit-ai/googleai';
import { RequestContext } from './interfaces.js';
import { PluginRegistry, createPluginRegistry } from './registry.js';
import { createRouteCatalog } from '../routing/index.js';
import { createApiServer } from '../routing/server.js';
import { SchemaMap, registerUserSchemas } from '../utils/schema-loader.js';
import { RouteManager, createRouteManager } from '../routing/route-manager.js';
import { FlowManager, createFlowManager } from '../routing/flow-manager.js';
import { TaskManager, createTaskManager } from '../routing/task-manager.js';
import { dateFormat } from '../utils/helpers/date-format.js';
import { findUp } from 'find-up';
import { pathToFileURL } from 'node:url';
import { ConfigManager } from './config.manager.js';
import { DatapromptUserConfig, DatapromptConfig } from './config.js';

export interface DatapromptStore {
  generate<Output = any>(url: string | Request | RequestContext): Promise<Output>;
  registry: PluginRegistry;
  routes: RouteManager;
  flows: FlowManager;
  tasks: TaskManager;
  ai: Genkit;
  userSchemas: SchemaMap;
}

// Initializes the default Genkit instance if the user doesn't provide one.
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

// Attempts to load a live Genkit instance from the user's config file.
async function loadUserGenkitInstance(rootDir: string): Promise<Genkit | undefined> {
  const configPath = await findUp(['dataprompt.config.js'], { cwd: rootDir });
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

export async function dataprompt(
  programmaticConfig?: DatapromptUserConfig
): Promise<DatapromptStore> {
  // Step 1: Load the static configuration from files. 
  // `fileConfig` is guaranteed to be a valid `DatapromptConfig`.
  const configManager = new ConfigManager();
  const fileConfig = await configManager.load();

  // Step 2: Create the final config by starting with a valid clone of the file-based config.
  const config: DatapromptConfig = {
    ...fileConfig,
    secrets: { ...fileConfig.secrets },
    plugins: [...fileConfig.plugins]
  };

  // Step 3: Explicitly override with programmatic values if they exist.
  // This is the key change that guarantees type safety.
  if (programmaticConfig) {
    if (programmaticConfig.rootDir) config.rootDir = programmaticConfig.rootDir;
    if (programmaticConfig.promptsDir) config.promptsDir = programmaticConfig.promptsDir;
    if (programmaticConfig.schemaFile) config.schemaFile = programmaticConfig.schemaFile;
    if (programmaticConfig.secrets) {
      Object.assign(config.secrets, programmaticConfig.secrets);
    }
    if (programmaticConfig.plugins) {
      config.plugins.push(...programmaticConfig.plugins);
    }
  }

  // Step 4: Initialize the Genkit service.
  const userGenkit = await loadUserGenkitInstance(config.rootDir);
  const ai = userGenkit || createDefaultGenkit(config);

  // Step 5: The rest of the setup uses the final, guaranteed type-safe config.
  const registry = createPluginRegistry(config.plugins);

  const userSchemas = await registerUserSchemas({
    genkit: ai,
    schemaFile: config.schemaFile,
    rootDir: config.rootDir
  });

  const catalog = await createRouteCatalog({
    promptDir: config.promptsDir,
    ai,
    registry,
    userSchemas,
    rootDir: config.rootDir,
  });

  const routeManager = createRouteManager(catalog);
  const flowManager = createFlowManager(routeManager);
  const taskManager = createTaskManager(catalog.tasks);

  return {
    async generate<Output>(url: string | Request | RequestContext) {
      const { route, request } = await routeManager.getRequest(url);
      if (!route) {
        throw new Error(`No route found for ${url}`);
      }
      return route.flow({ request }) as Output;
    },
    routes: routeManager,
    flows: flowManager,
    tasks: taskManager,
    registry,
    ai,
    userSchemas,
  };
}

export async function createPromptServer(options: {
  config?: DatapromptUserConfig;
  startTasks?: boolean;
} = { startTasks: true }) {
  const { startTasks, config } = options;
  const store = await dataprompt(config);
  const server = await createApiServer({ store, startTasks });
  return { store, server };
}

import type { Genkit } from 'genkit';
import { RequestContext } from './interfaces.js';
import { PluginRegistry, createPluginRegistry } from './registry.js';
import { createRouteCatalog } from '../routing/index.js';
import { createApiServer } from '../routing/server.js';
import { loadKeys, DatapromptConfig, resolveConfig } from './config.js';
import { registerUserSchemas } from '../utils/schema-loader.js';
import { RouteManager, createRouteManager } from '../routing/route-manager.js';
import { FlowManager, createFlowManager } from '../routing/flow-manager.js';
import { TaskManager, createTaskManager } from '../routing/task-manager.js';

export interface DatapromptStore {
  generate<Output = any>(url: string): Promise<Output>;
  generate<Output = any>(request: Request): Promise<Output>;
  generate<Output = any>(requestContext: RequestContext): Promise<Output>;
  registry: PluginRegistry;
  routes: RouteManager;
  flows: FlowManager;
  tasks: TaskManager;
  ai: Genkit;
}

export async function dataprompt(
  config?: Partial<DatapromptConfig>
): Promise<DatapromptStore> {
  await loadKeys();
  const resolvedConfig = await resolveConfig(config);

  const ai = resolvedConfig.genkit!;
  const registry = createPluginRegistry(resolvedConfig.plugins);

  await registerUserSchemas(ai, resolvedConfig.schemaFile);
  const catalog = await createRouteCatalog({
    basePath: resolvedConfig.promptsDir,
    ai,
    registry,
  });
  const routeManager = createRouteManager(catalog);
  const flowManager = createFlowManager(routeManager);
  const taskManager = createTaskManager(catalog.tasks);

  const store: DatapromptStore = {
    async generate<Output>(url: string | Request | RequestContext) {
      try {
        const { route, request } = await routeManager.getRequest(url);
        if (!route) {
          throw new Error(`No route found for ${url}`);
        }
        return route.flow({ request }) as Output;
      } catch (error) {
        throw error;
      }
    },
    routes: routeManager,
    flows: flowManager,
    tasks: taskManager,
    registry,
    ai,
  };
  return store;
}

export async function createPromptServer(options: {
  config?: DatapromptConfig;
  startTasks?: boolean;
} = { startTasks: true}) {
  const { startTasks, config } = options
  const store = await dataprompt(config);
  const server = await createApiServer({ store, startTasks });
  return { store, server };
}

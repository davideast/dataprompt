import { Genkit } from 'genkit';
import { ScheduledTask } from 'node-cron';
import { DatapromptRoute } from './server.js';
import { PluginRegistry } from '../core/registry.js';
import { createRoute } from './route-builder.js';
import { createFileMap } from './file-system.js';
import { SchemaMap } from '../utils/schema-loader.js';
import { events } from '../core/events.js';
import { randomUUID } from 'node:crypto';

// TODO(davideast): Simplify routing approach to not duplicate routes
export type RouteCatalog = {
  express: Map<string, DatapromptRoute>;
  next: Map<string, DatapromptRoute>;
  tasks: Map<string, ScheduledTask>;
}

export function createTask(
  triggerDef: Record<string, any>,
  route: DatapromptRoute,
  registry: PluginRegistry
) {
  // .trigger -> "firebase.schedule" should be { firebase: { schedule: '' }}
  const triggerKeys = Object.keys(triggerDef);
  // TODO(davideast): "firebase.schedule" is a single unparsed YAML key
  // We'll need to parse it and treat it as an object { firebase: { schedule }}
  const provider = triggerKeys.at(0);
  if (!provider) {
    throw new Error(`No trigger provider found for ${route.expressRoute}`);
  }
  const config = triggerDef[provider]
  const trigger = registry.getTrigger(provider);
  if (!trigger) {
    throw new Error(`No trigger found for ${provider}`);
  }
  return trigger.create(route, config);
}

export async function createRouteCatalog(params: {
  ai: Genkit;
  promptDir: string;
  registry: PluginRegistry;
  userSchemas: SchemaMap;
  rootDir: string;
}): Promise<RouteCatalog> {
  const { ai, promptDir, registry, userSchemas, rootDir } = params;
  const express: Map<string, DatapromptRoute> = new Map();
  const next: Map<string, DatapromptRoute> = new Map();
  const tasks: Map<string, ScheduledTask> = new Map();
  const fileMap = await createFileMap(promptDir);

  for (const [expressRoute, file] of fileMap.entries()) {
    try {
      // Use the imported createRoute function
      const route = await createRoute({
        ai,
        file,
        userSchemas,
        expressRoute,
        registry,
        rootDir,
      });
      const triggerDef = route.flowDef.data?.prompt?.trigger;
      if (triggerDef) {
        const triggerKeys = Object.keys(triggerDef);
        const provider = triggerKeys.at(0);
        if(!provider) {
          throw new Error(`No trigger provider found for ${route.expressRoute}`);
        }
        const config = triggerDef[provider]
        const task = createTask(triggerDef, route, registry)
        tasks.set(expressRoute, task);
        events.emit('task:created', {
          id: randomUUID(),
          route: route.nextRoute,
          task,
          timestamp: performance.now(),
          provider,
          config,
        })
      } else {
        express.set(expressRoute, route);
        next.set(route.nextRoute, route);
      }
    } catch (error) {
      throw error;
      // throw new Error(`Error processing prompt file ${file.path}: ${error}`);
    }
  }
  return { express, next, tasks };
}

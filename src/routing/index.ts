// src/routing/index.ts (Updated and Final)

import { Genkit } from 'genkit';
import { ScheduledTask } from 'node-cron';
import { DatapromptRoute } from './server.js';
import { PluginManager } from '../core/plugin.manager.js'; // Import the new manager
import { createRoute } from './route-builder.js';
import { createFileMap } from './file-system.js';
import { SchemaMap } from '../utils/schema-loader.js';
import { events } from '../core/events.js';
import { randomUUID } from 'node:crypto';

export type RouteCatalog = {
  express: Map<string, DatapromptRoute>;
  next: Map<string, DatapromptRoute>;
  tasks: Map<string, ScheduledTask>;
}

/**
 * Creates a scheduled task by retrieving the appropriate trigger provider
 * from the PluginManager.
 * @param triggerDef The trigger definition from the prompt file's YAML.
 * @param route The dataprompt route this task is associated with.
 * @param pluginManager The application's central PluginManager instance.
 */
function createTask(
  triggerDef: Record<string, any>,
  route: DatapromptRoute,
  pluginManager: PluginManager
): ScheduledTask {
  // The trigger definition in YAML, e.g., `schedule: { cron: '...' }`,
  // uses the provider name as the key.
  const providerName = Object.keys(triggerDef)[0];
  if (!providerName) {
    throw new Error(`Invalid trigger definition for route ${route.expressRoute}: Missing provider name.`);
  }

  const config = triggerDef[providerName];
  // TODO(davideast): This needs way better naming. 
  // getTrigger() gets the TriggerProvider. 
  // createTrigger() creates the Trigger. 
  // create() creates the ScheduledTask.
  const triggerProvider = pluginManager.getTrigger(providerName);
  const trigger = triggerProvider.createTrigger();
  return trigger.create(route, config);
}

/**
 * Scans the prompts directory and constructs a catalog of all available
 * HTTP routes and scheduled tasks.
 * @param params An object containing the application's core services.
 */
export async function createRouteCatalog(params: {
  ai: Genkit;
  promptDir: string;
  pluginManager: PluginManager; // Updated from 'registry'
  userSchemas: SchemaMap;
  rootDir: string;
}): Promise<RouteCatalog> {
  const { ai, promptDir, pluginManager, userSchemas, rootDir } = params;
  const express: Map<string, DatapromptRoute> = new Map();
  const next: Map<string, DatapromptRoute> = new Map();
  const tasks: Map<string, ScheduledTask> = new Map();
  const fileMap = await createFileMap(promptDir);

  for (const [expressRoute, file] of fileMap.entries()) {
    try {
      // The createRoute function must also be updated to accept pluginManager.
      // This is assumed to be done in a subsequent step.
      const route = await createRoute({
        ai,
        file,
        userSchemas,
        expressRoute,
        pluginManager, // Pass the manager down
        rootDir,
      });

      const triggerDef = route.flowDef.data?.prompt?.trigger;
      if (triggerDef) {
        // If a trigger is defined, create a task instead of an HTTP route.
        const task = createTask(triggerDef, route, pluginManager);
        tasks.set(expressRoute, task);
        
        events.emit('task:created', {
          id: randomUUID(),
          route: route.nextRoute,
          task,
          timestamp: performance.now(),
          provider: Object.keys(triggerDef)[0],
          config: Object.values(triggerDef)[0],
        })
      } else {
        // Otherwise, register it as a standard HTTP route.
        express.set(expressRoute, route);
        next.set(route.nextRoute, route);
      }
    } catch (error: any) {
      // Add more context to errors to make debugging easier.
      throw new Error(`Error processing prompt file '${file.path}': ${error.message}`);
    }
  }
  return { express, next, tasks };
}

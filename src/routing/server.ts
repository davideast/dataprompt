import express from 'express';
import { RequestContext } from '../core/interfaces.js';
import { DatapromptStore } from '../core/dataprompt.js';
import { events } from '../core/events.js';
import { getLogManager } from '../utils/logging.js';
import { createPromptFlow, FlowDefinition } from './flow-builder.js';

export interface DatapromptRoute {
  flowDef: FlowDefinition;
  flow: ReturnType<typeof createPromptFlow>;
  promptFilePath: string;
  nextRoute: string;
  expressRoute: string;
}

function createRouteHandler({ 
  expressRoute,
  store,
}: { 
  expressRoute: string 
  store: DatapromptStore
}) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let requestContext = toRequestContext(req);
    const route = store.routes.single(expressRoute);
    if (!route) {
      throw new Error(`No route found for ${expressRoute}`);
    }
    const requestLogger = getLogManager().createRequestLogger({
      route,
      request: requestContext
    });
    requestContext.requestId = requestLogger.id;
    events.emit('request:started', {
      requestLogger,
      timestamp: performance.now(),
    });
    try {
      const result = await route.flow({
        request: requestContext
      });
      requestLogger.flowEvent({
        flowName: route.flow.name,
        inputSchema: route.flowDef.promptMetadata.input?.schema,
        input: requestContext
      });
      requestLogger.complete()
      // Logging is enabled for this request
      if(requestContext.requestId != null) {
        res.setHeader('X-Request-ID', requestContext.requestId);
      }
      res.json(result);
    } catch (error) {
      requestLogger.error(error as Error);
      next(error);
    }
  };
}

function toRequestContext(req: express.Request): RequestContext {
  return {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(', ') : value || ''
      ])
    ),
    params: req.params,
    query: req.query as Record<string, string>,
    body: {
      json: req.is('application/json') ? req.body : undefined,
      form: req.is('application/x-www-form-urlencoded') ? req.body : undefined,
      text: req.is('text/*') ? req.body : undefined
    }
  };
}

export async function createApiServer({ store, startTasks }: {
  store: DatapromptStore,
  startTasks?: boolean 
}) {
  const routes = store.routes.all();
  const server = express();
  startTasks = startTasks ?? true; 
  server.use(express.json());
  server.use(express.text());
  server.use(express.urlencoded({ extended: true }));
  
  if (startTasks) {
    store.tasks.startAll();
  }

  for (const [expressRoute] of routes.entries()) {
    server.all(
      expressRoute, 
      await createRouteHandler({ expressRoute, store })
    );
  }
  
  return server;
}

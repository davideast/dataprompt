import express from 'express';
import { DatapromptStore } from '../core/dataprompt.js';
import { events } from '../core/events.js';
import { getLogManager } from '../utils/logging.js';
import { createPromptFlow, FlowDefinition } from './flow-builder.js';
import { createRequestContext } from '../utils/helpers/request.js';

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
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const standardRequest = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    let requestContext = await createRequestContext(standardRequest);

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
      requestLogger.complete();
      if (requestContext.requestId != null) {
        res.setHeader('X-Request-ID', requestContext.requestId);
      }
      res.json(result);
    } catch (error) {
      requestLogger.error(error as Error);
      next(error);
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

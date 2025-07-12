import { DatapromptRoute } from './server.js';
import { routeMatcher, RouteResult, MatchResult } from './route-matcher.js';
import { RequestContext } from '../core/interfaces.js';
import { createRequestContext } from '../utils/helpers/request.js';
import { RouteCatalog } from './index.js';

export interface RouteManager {
  single(expressOrNextRoute: string): DatapromptRoute | undefined;
  all(system: 'express' | 'next'): Map<string, DatapromptRoute>;
  all(): Map<string, DatapromptRoute>;
  match(path: string): RouteResult;
  getRequest(url: string | Request | RequestContext): Promise<{
    route: DatapromptRoute;
    request: RequestContext;
  }>;
}

export function createRouteManager(catalog: RouteCatalog): RouteManager {
  const matcher = routeMatcher({
    nextPaths: Array.from(catalog.next.keys()),
    expressPaths: Array.from(catalog.express.keys()),
  });
  return {
    single(expressOrNextRoute: string) {
      const { match, system } = matcher(expressOrNextRoute);
      if (match == null) {
        throw new Error(`No matched route found for ${expressOrNextRoute}`);
      }
      let route = getRouteResultFromCatalog({ catalog, match, system });
      return route;
    },
    all(system: 'express' | 'next' = 'express') {
      switch (system) {
        case 'express':
          return catalog.express;
        case 'next':
          return catalog.next;
        default:
          throw new Error(`Unknown system: ${system}`)
      }
    },
    match(path: string) {
      return matcher(path);
    },
    async getRequest(url: string | Request | RequestContext) {
      const requestUrl = typeof url === 'string' ? url : url.url;
      const result = matcher(requestUrl);

      if (result.match == null) {
        throw new Error(`No matched route found for ${requestUrl}`);
      }

      const route = catalog.next.get(result.match.matchedRoute);
      if (!route) {
        throw new Error(`No flow found for route: ${result.match.matchedRoute}`);
      }

      const request = await createRequestContext(url, result.match);

      return { route, request };
    }
  };
}

function getRouteResultFromCatalog(params: {
  catalog: RouteCatalog,
  system: 'express' | 'next' | 'static',
  match: MatchResult
}): DatapromptRoute | undefined {
  const { catalog, match, system } = params;
  switch (system) {
    case 'express':
      return catalog.express.get(match.matchedRoute);
    case 'next':
      return catalog.next.get(match.matchedRoute);
    case 'static':
      return catalog.next.get(match.matchedRoute);
  }
}

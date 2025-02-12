import { DatapromptRoute } from './server.js';
import { RouteManager } from './route-manager.js';

export interface FlowManager {
  single(expressOrNextRoute: string): DatapromptRoute['flow'];
  all(): Map<string, DatapromptRoute['flow']>;
  list(): DatapromptRoute['flow'][];
}

export function createFlowManager(routeManager: RouteManager): FlowManager {
  return {
    single(expressOrNextRoute: string) {
      const route = routeManager.single(expressOrNextRoute);
      if (!route) {
        throw new Error(`No route found for ${expressOrNextRoute}`);
      }
      return route.flow;
    },
    all() {
      const flowMap = new Map<string, DatapromptRoute['flow']>();
      for (let [expressRoute, route] of routeManager.all().entries()) {
        flowMap.set(expressRoute, route.flow);
      }
      return flowMap;
    },
    list() {
      return Array.from(routeManager.all().values()).map(route => route.flow);
    }
  };
}
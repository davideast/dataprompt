import { match } from 'path-to-regexp'

export interface RouteParam {
  name: string;
  catchAll: boolean;
}

export interface CompiledRoute {
  regex: RegExp;
  params: RouteParam[];
  originalRoute: string;
}

export interface MatchResult {
  matchedRoute: string;
  routeParams: Partial<Record<string, string | string[]>>;
}

export function detectRouteSystem(url: string) {
  const expressRegex = /\/:[^/]+/;  // Express: /:param
  const nextRegex = /\/\[(?:\.{3})?[^/]+\]/; // Next: /[param] and /[...param]

  const isExpress = expressRegex.test(url);
  const isNext = nextRegex.test(url);

  if (isExpress && isNext) {
    // Likely would need to throw and tell the user
    // they are mixing route patterns
    return "mixed";
  } else if (isExpress) {
    return "express";
  } else if (isNext) {
    return "next";
  } else {
    // just a regular static route path
    return "static";
  }
}

export interface RouteResult {
  system: 'express' | 'next' | 'static';
  match: MatchResult | null;
}

export function routeMatcher({ expressPaths, nextPaths }: {
  expressPaths: string[],
  nextPaths: string[]
}) {
  const nextMatcher = nextRouteMatcher(nextPaths);
  const expressMatcher = match(expressPaths)
  return function (expressOrNextRoute: string): RouteResult {
    const routeSystem = detectRouteSystem(expressOrNextRoute);
    switch (routeSystem) {
      // Handle /items/:id
      case 'express': {
        const matched = expressMatcher(expressOrNextRoute);
        if (matched != false) {
          return {
            system: 'express',
            match: {
              matchedRoute: matched.path,
              routeParams: matched.params,
            }
          }
        }
      }
      // Handle /items[id] or /blogs/[...blog]
      case 'next': {
        const match = nextMatcher(expressOrNextRoute);
        return {
          system: 'next',
          match
        };
      }
      // Handle /items/123 with next style routing, will match params
      case 'static': {
        let match = nextMatcher(expressOrNextRoute);
        let system: 'express' | 'next' | 'static' = match == null ? 'static' : 'next';
        if (match == null) {
          const expressMatch = expressMatcher(expressOrNextRoute)
          if (expressMatch != false) {
            system = 'express'
            match = {
              matchedRoute: expressMatch.path,
              routeParams: expressMatch.params,
            }
          }
        }
        return {
          system,
          match
        };
      }
      // Throw for vague situatins like /items/[:id] or /items/:uid/[id]
      case 'mixed':
        throw new Error(`Mixed route detected: ${expressOrNextRoute}. Ensure the route is either express (:id) or next style ([id]) and not a mix of both.`);
      default:
        throw new Error('Route system not supported: ' + routeSystem);
    }
  }
}

/**
 * Creates a Next.js-style route matcher.
 *
 * @param {string[]} routes - An array of route strings.  These strings
 *   can include named parameters (e.g., `[paramName]`) and catch-all
 *   parameters (e.g., `[...paramName]`).
 * @returns {(url: string) => MatchResult | null} A function that takes a URL
 *   string and returns a `MatchResult` object if a route matches, or `null`
 *   if no route matches.
 *
 * @example
 * const routeMatcher = nextRouteMatcher([
 *   "/health",
 *   "/api/items/[itemId]",
 *   "/blog/[...slug]",
 * ]);
 *
 * const match_1 = routeMatcher("/shark");
 * // match_1: { matchedRoute: "/shark", routeParams: {} }
 *
 * const match_2 = routeMatcher("/api/shark/great-white");
 * // match_2: { matchedRoute: "/api/shark/[shark]", routeParams: { shark: "great-white" } }
 *
 * const match_3 = routeMatcher("/blog/2025/01/30");
 * // match_3: { matchedRoute: "/blog/[...slug]", routeParams: { slug: ["2025", "01", "30"] } }
 *
 * const noMatch = routeMatcher("/shark/gerbil-shark");
 * // noMatch: null
 */
function nextRouteMatcher(routes: string[]): (url: string) => MatchResult | null {
  const compiledRoutes: CompiledRoute[] = routes.map(route => {
    const routeParts = route.split('/');
    const params: RouteParam[] = [];
    const regexParts = routeParts.map(part => {
      if (part.startsWith('[...') && part.endsWith(']')) {
        const paramName = part.slice(4, -1);
        params.push({ name: paramName, catchAll: true });
        return '(.*)'; // Match anything
      } else if (part.startsWith('[') && part.endsWith(']')) {
        const paramName = part.slice(1, -1);
        params.push({ name: paramName, catchAll: false });
        return '([^/]+)'; // Match anything except a forward slash
      } else {
        return part;
      }
    });

    const regex = new RegExp('^' + regexParts.join('/') + '$');
    return { regex, params, originalRoute: route };
  });

  /**
   * Matches a URL against the defined routes.
   *
   * @param {string} url - The URL to match.
   * @returns {MatchResult | null} A `MatchResult` object if a route
   *   matches, or `null` if no route matches.
   *
   * @inner  This function is returned by `nextRouteMatcher`.
   */
  return function matcher(url: string): MatchResult | null {
    for (const compiledRoute of compiledRoutes) {
      const match = url.match(compiledRoute.regex);

      if (match) {
        const routeParams: Record<string, string | string[]> = {};
        let matchIndex = 1; // Start at 1 to skip the full match

        for (const param of compiledRoute.params) {
          if (param.catchAll) {
            routeParams[param.name] = match[matchIndex].split("/");
            matchIndex++; // only increment once, as the catch-all captures the rest.
          } else {
            routeParams[param.name] = match[matchIndex];
            matchIndex++;
          }
        }

        return {
          matchedRoute: compiledRoute.originalRoute,
          routeParams,
        };
      }
    }

    return null; // No match found
  };
}

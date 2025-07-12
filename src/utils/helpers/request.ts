import { RequestContext, RequestContextSchema } from "../../core/interfaces.js";
import { MatchResult } from "../../routing/route-matcher.js";

/**
 * A universal helper to create a valid RequestContext from various inputs.
 * It can handle a URL string, a standard Request object, or a raw RequestContext.
 * @param input The source to convert into a RequestContext.
 * @param matchResult Optional route matching result containing URL parameters.
 * @returns A promise that resolves to a valid RequestContext object.
 */
export async function createRequestContext(
  input: string | Request | RequestContext,
  matchResult: MatchResult | null = null
): Promise<RequestContext> {
  // Case 1: Input is already a RequestContext object.
  if (typeof input === 'object' && !(input instanceof Request) && input.url) {
    const contextToValidate = { ...input };

    // Explicitly and safely merge route parameters.
    if (matchResult?.routeParams) {
      // Start with existing params, or an empty object if none exist.
      const newParams = { ...(input.params || {}) };
      // Iterate and only assign non-undefined values from the route match.
      for (const [key, value] of Object.entries(matchResult.routeParams)) {
        if (value !== undefined) {
          newParams[key] = value;
        }
      }
      contextToValidate.params = newParams;
    }

    const result = RequestContextSchema.safeParse(contextToValidate);
    if (!result.success) {
      throw new Error(`Invalid RequestContext provided: ${result.error.message}`);
    }
    return result.data;
  }

  // Case 2: Input is a standard web Request object.
  if (input instanceof Request) {
    const url = new URL(input.url);
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of url.searchParams) {
      if (query[key]) {
        if (Array.isArray(query[key])) {
          (query[key] as string[]).push(value);
        } else {
          query[key] = [query[key] as string, value];
        }
      } else {
        query[key] = value;
      }
    }

    const context: Partial<RequestContext> = {
      method: input.method,
      url: input.url,
      headers: Object.fromEntries(input.headers.entries()),
      query,
      params: matchResult?.routeParams as Record<string, string | string[]> || {},
    };

    try {
      if (input.headers.get('content-type')?.includes('application/json')) {
        context.body = { json: await input.json() };
      } else if (input.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
        const formData = await input.formData();
        const form: Record<string, any> = {};
        for (const [key, value] of formData.entries()) {
          form[key] = value;
        }
        context.body = { form };
      } else if (input.body) {
        context.body = { text: await input.text() };
      }
    } catch (error: any) {
      throw new Error(`Error parsing request body: ${error.message}`);
    }

    const result = RequestContextSchema.safeParse(context);
    if (!result.success) {
      throw new Error(`Invalid Request from Request object: ${result.error.message}`);
    }
    return result.data;
  }

  // Case 3: Input is a simple URL string.
  if (typeof input === 'string') {
    const url = new URL(input, 'http://localhost');
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of url.searchParams) {
      if (query[key]) {
        if (Array.isArray(query[key])) {
          (query[key] as string[]).push(value);
        } else {
          query[key] = [query[key] as string, value];
        }
      } else {
        query[key] = value;
      }
    }

    const context: Partial<RequestContext> = {
      method: "GET",
      url: input,
      query,
      params: matchResult?.routeParams as Record<string, string | string[]> || {},
      headers: {},
    };

    const result = RequestContextSchema.safeParse(context);
    if (!result.success) {
      throw new Error(`Invalid Request from string: ${result.error.message}`);
    }
    return result.data;
  }

  throw new Error('Unsupported input type for createRequestContext. Must be a URL string, Request, or RequestContext.');
}

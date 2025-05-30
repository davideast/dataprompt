import { RequestContext, RequestContextSchema } from "../../core/interfaces.js";
import { MatchResult } from "../../routing/route-matcher.js";

async function convertToRequestContext_old(
  url: string | Request | RequestContext,
  matchResult: MatchResult | null = null
) {
  if (typeof url === 'string') {
    return { url };
  } else if (url instanceof Request) {
    return requestToContext(url, matchResult);
  } else {
    return { ...url, params: matchResult?.routeParams || {} };
  }
}

async function requestToContext_old(
  request: Request,
  matchResult: MatchResult | null
): Promise<RequestContext> {
  const baseUrl = `http://${request.headers.get('host') || 'localhost'}`;
  const url = new URL(request.url, baseUrl);

  const context: RequestContext = {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    query: {},
    params: {},
  };

  url.searchParams.forEach((value, key) => {
    context.query![key] = value;
  });

  if (matchResult) {
    context.params = matchResult.routeParams as Record<string, string | string[]>;
  }

  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      context.body = { json: await request.json() };
    } else if (request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      context.body = { form: {} };
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') {
          context.body.form![key] = value;
        }
      }
    } else {
      context.body = { text: await request.text() };
    }
  } catch (error) {
    console.error("Error parsing request body:", error);
    throw new Error("Invalid request body");
  }

  return context;
}

export async function convertToRequestContext(
  input: string | Request | RequestContext,
  matchResult: MatchResult | null = null,
  defaultBaseUrl: string = ''
): Promise<RequestContext> {
  if (typeof input === 'string') {
    return requestContextFromString(input, matchResult, defaultBaseUrl);
  } else if (input instanceof Request) {
    return requestToContext(input, matchResult);
  } else {
    const result = RequestContextSchema.safeParse({ ...input, params: matchResult?.routeParams || {} });
    if (!result.success) {
      throw new Error(`Invalid RequestContext: ${result.error}`);
    }
    return result.data;
  }
}

async function requestContextFromString(
  urlString: string,
  matchResult: MatchResult | null,
  defaultBaseUrl: string,
): Promise<RequestContext> {
  const url = new URL(urlString, defaultBaseUrl);
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
    method: "GET", // Default to GET for string URLs
    url: url.toString(),
    query,
    params: matchResult?.routeParams as Record<string, string | string[]> || {},
    headers: {}, // No headers when created from a string
  };
  const result = RequestContextSchema.safeParse(context);
  if (!result.success) {
    throw new Error(`Invalid RequestContext: ${result.error}`);
  }
  return result.data;
}

async function requestToContext(
  request: Request,
  matchResult: MatchResult | null
): Promise<RequestContext> {
  const url = new URL(request.url);
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
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    query,
    params: matchResult?.routeParams as Record<string, string | string[]> || {},
  };

  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      context.body = { json: await request.json() };
    } else if (request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      const form: Record<string, any> = {};
      for (const [key, value] of formData.entries()) {
        form[key] = value;
      }
      context.body = { form };
    } else if (request.headers.get('content-type')) {
      context.body = { text: await request.text() };
    }
  } catch (error: any) {
    console.error("Error parsing request body:", error);
    throw new Error(`Error parsing request body: ${error.message}`);
  }
  const result = RequestContextSchema.safeParse(context);
  if (!result.success) {
    throw new Error(`Invalid RequestContext: ${result.error}`);
  }
  return result.data;
}

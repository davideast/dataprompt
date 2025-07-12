import { describe, it, expect } from 'vitest';
import { createRequestContext } from '../../src/utils/helpers/request.js';
import { RequestContext } from '../../src/core/interfaces';
import { MatchResult } from '../../src/routing/route-matcher.js';

describe('createRequestContext', () => {
  it('should handle a simple URL string', async () => {
    const context = await createRequestContext('/test/path');
    expect(context.url).toBe('/test/path');
    expect(context.method).toBe('GET');
  });

  it('should parse query parameters from a URL string', async () => {
    const context = await createRequestContext('/test/path?foo=bar&baz=qux');
    expect(context.query).toEqual({ foo: 'bar', baz: 'qux' });
  });

  it('should handle route parameters', async () => {
    const matchResult: MatchResult = { 
        matchedRoute: '/users/[id]', // The route pattern that was matched.
        routeParams: { id: '123' } 
    };
    const context = await createRequestContext('/users/123', matchResult);
    expect(context.params).toEqual({ id: '123' });
  });

  it('should parse a JSON body from a Request object', async () => {
    const mockRequest = new Request('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });
    const context = await createRequestContext(mockRequest);
    expect(context.body?.json).toEqual({ message: 'hello' });
  });
  
  it('should return an existing RequestContext object unmodified', async () => {
    const existingContext: RequestContext = {
        url: '/pre-existing',
        method: 'POST',
        body: { json: { data: 'test' } }
    };
    const context = await createRequestContext(existingContext);
    expect(context).toEqual(existingContext);
  });
});
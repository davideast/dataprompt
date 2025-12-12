import { describe, it, expect } from 'vitest';
import { createRequestContext, convertHeaders } from '../../src/utils/helpers/request.js';
import { RequestContext } from '../../src/core/interfaces';
import { MatchResult } from '../../src/routing/route-matcher.js';
import { IncomingHttpHeaders } from 'http';

describe('convertHeaders', () => {
    it('should correctly handle string headers', () => {
        const headers: IncomingHttpHeaders = {
            'content-type': 'application/json',
            'x-api-key': '12345'
        };
        const fetchHeaders = convertHeaders(headers);
        expect(fetchHeaders.get('content-type')).toBe('application/json');
        expect(fetchHeaders.get('x-api-key')).toBe('12345');
    });

    it('should correctly handle array headers', () => {
        const headers: IncomingHttpHeaders = {
            'x-custom-list': ['item1', 'item2']
        };
        const fetchHeaders = convertHeaders(headers);
        // Headers.get returns values comma-separated
        expect(fetchHeaders.get('x-custom-list')).toBe('item1, item2');
    });

    it('should ignore undefined headers', () => {
        const headers: IncomingHttpHeaders = {
            'x-valid': 'true',
            'x-undefined': undefined
        };
        const fetchHeaders = convertHeaders(headers);
        expect(fetchHeaders.has('x-valid')).toBe(true);
        expect(fetchHeaders.has('x-undefined')).toBe(false);
    });

    it('should handle mixed string and array headers', () => {
        const headers: IncomingHttpHeaders = {
            'x-single': 'value',
            'x-multiple': ['v1', 'v2']
        };
        const fetchHeaders = convertHeaders(headers);
        expect(fetchHeaders.get('x-single')).toBe('value');
        expect(fetchHeaders.get('x-multiple')).toBe('v1, v2');
    });
});

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
import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import http from 'http';

export function createMockMcpServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = new McpServer({
      name: 'mock-mcp-server',
      version: '1.0.0',
    });

    server.registerTool(
      'test-tool',
      {
        title: 'Test Tool',
        description: 'A test tool for integration tests',
        inputSchema: { input: z.string() },
        outputSchema: { output: z.string() },
      },
      async ({ input }) => {
        const output = { output: `test-tool-output-for-${input}` };
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        };
      }
    );

    const app = express();
    app.use(express.json());

    app.post('/mcp', async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on('close', () => {
        transport.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    const httpServer = app.listen(3002, () => {
      console.log('Mock MCP Server running on http://localhost:3002/mcp');
      resolve(httpServer);
    });
  });
}
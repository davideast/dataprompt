import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { Genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

import { Prompt } from '../../src/core/prompt.js';
import { PluginManager } from '../../src/core/plugin.manager.js';
import { DatapromptConfig } from '../../src/core/config.js';
import { DatapromptFile, RequestContext } from '../../src/core/interfaces.js';
import { createRoute } from '../../src/routing/route-builder.js';
import { SchemaMap, registerUserSchemas } from '../../src/utils/schema-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define the schemas that will be used by the test prompts.
const TestSchema = z.object({
  data: z.string(),
  explanation: z.string(),
});

const HNSchema = z.object({
  topThree: z.array(z.object({
    title: z.string(),
    url: z.string(),
  }))
});

// A map to hold all the prompt definitions for easy creation.
const promptDefinitions = new Map([
  ['invoices/[id].prompt', {
    template: 'Invoice ID: {{request.params.id}}',
    outputSchemaName: 'TestSchema',
    useFetch: false,
    requestContext: { url: '/invoices/123', params: { id: '123' } }
  }],
  ['hn/home.prompt', {
    template: `Provide me the top 3 stories from Hacker News \\n\\n{{json news}}`,
    outputSchemaName: 'HNSchema',
    useFetch: true,
    requestContext: { url: '/hn/home' }
  }],
]);

function getPromptContent(template: string, outputSchemaName: string, useFetch: boolean) {
  const model = 'googleai/gemini-2.0-flash';
  const frontmatter = useFetch ? `---
model: ${model}
data.prompt:
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/1.json
output:
  schema: ${outputSchemaName}
---` : `---
model: ${model}
output:
  schema: ${outputSchemaName}
---`;
  return `${frontmatter}\n${template}`;
}

describe('Prompt Class Integration Tests', () => {
  let tempDir: string;
  let pluginManager: PluginManager;
  let ai: Genkit;
  let userSchemas: SchemaMap;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(__dirname, '../', 'prompt-class-test-'));
    const promptsDir = path.join(tempDir, 'prompts');
    const schemaFile = path.join(tempDir, 'schema.js');
    await fs.mkdir(promptsDir, { recursive: true });
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

    const schemaFileContent = `
      import { z } from 'genkit';
      export const TestSchema = z.object({
        data: z.string(),
        explanation: z.string(),
      });
      export const HNSchema = z.object({
        topThree: z.array(z.object({
          title: z.string(),
          url: z.string(),
        }))
      });
    `;
    await fs.writeFile(schemaFile, schemaFileContent);
    
    for (const [filePath, definition] of promptDefinitions.entries()) {
        const absolutePath = path.resolve(promptsDir, filePath);
        const dirPath = path.dirname(absolutePath);
        try { await fs.access(dirPath); } catch { await fs.mkdir(dirPath, { recursive: true }); }
        const content = getPromptContent(definition.template, definition.outputSchemaName, definition.useFetch);
        await fs.writeFile(absolutePath, content);
    }

    const config: DatapromptConfig = {
        rootDir: tempDir,
        promptsDir: promptsDir,
        schemaFile: schemaFile,
        secrets: {
            GOOGLEAI_API_KEY: process.env.GOOGLEAI_API_KEY || 'test-key',
            GOOGLE_APPLICATION_CREDENTIALS: './fake-creds.json'
        },
        plugins: []
    };
    
    ai = new Genkit({ plugins: [googleAI({ apiKey: config.secrets.GOOGLEAI_API_KEY })] });
    pluginManager = new PluginManager(config);
    userSchemas = await registerUserSchemas({ genkit: ai, schemaFile, rootDir: tempDir });

  }, 40000);

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  for (const [filePath, definition] of promptDefinitions.entries()) {
    it(`should execute the prompt from '${filePath}' correctly`, async () => {
        const file: DatapromptFile = {
            path: path.join(tempDir, 'prompts', filePath),
            content: getPromptContent(definition.template, definition.outputSchemaName, definition.useFetch),
            nextRoute: filePath.replace('.prompt', '')
        };

        const route = await createRoute({
            ai,
            file,
            userSchemas,
            expressRoute: `/${file.nextRoute}`,
            pluginManager,
            rootDir: tempDir
        });

        const prompt = new Prompt({
            ai,
            flowDef: route.flowDef,
            pluginManager,
            file,
        });

        const requestContext = definition.requestContext as RequestContext;
        const result = await prompt.execute(requestContext);
        
        expect(result).toBeDefined();
        // You could add more specific assertions here based on the expected output
        // For example, for the invoice prompt:
        if (filePath.startsWith('invoices')) {
            expect(result.data).toContain('123');
        }
        // For the Hacker News prompt:
        if (filePath.startsWith('hn')) {
            expect(result.topThree).toBeInstanceOf(Array);
            expect(result.topThree.length).toBe(3);
        }
    });
  }
});

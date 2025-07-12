import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createPromptServer } from '../../src/index.js';
import path from 'path';
import { DatapromptPlugin } from '../../src/core/interfaces.js';
import type { Server } from 'http';
import * as fs from 'node:fs/promises';
import { DatapromptStore } from '../../src/core/dataprompt.js';
import { z } from 'genkit';
import { findTestRoot } from '../utils.js';

// A map to hold all the prompt definitions for easy creation.
const promptDefinitions = new Map([
  ['invoices/[id].prompt', {
    template: 'Invoice ID: {{request.params.id}}',
    outputSchemaName: 'TestSchema',
    useFetch: false,
  }],
  ['items/[uid]/[itemId].prompt', {
    template: `Say this exactly word for word: "This Item ID is {{request.params.itemId}} and this UID is {{request.params.uid}}"`,
    outputSchemaName: 'TestSchema',
    useFetch: false,
  }],
  ['hn/home.prompt', {
    template: `Provide me the top 3 stories from Hacker News \\n\\n{{json news}}`,
    outputSchemaName: 'HNSchema',
    useFetch: true,
  }],
  ['test/parts.prompt', {
    template: `{{role "system"}}\\nYou are a pirate. Talk like one.\\n{{role "user"}} \\n\\nMy name is David, give me my pirate name."`,
    outputSchemaName: 'TestSchema',
    useFetch: false,
  }]
]);

// Helper function to generate prompt file content.
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

describe('dataprompt server & store', () => {
  let httpServer: Server;
  let tempDir: string;
  let store: DatapromptStore;

  beforeAll(async () => {
    const testRootDir = findTestRoot(import.meta.url);
    tempDir = await fs.mkdtemp(path.join(testRootDir, 'dataprompt-test-'));
    const promptsDir = path.join(tempDir, 'prompts');
    const schemaFile = path.join(tempDir, 'schema.js');
    await fs.mkdir(promptsDir, { recursive: true });

    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

    // THIS IS THE KEY FIX: Write a valid JavaScript module that exports Zod schemas.
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
    
    // Write all prompt files.
    for (const [filePath, definition] of promptDefinitions.entries()) {
        const absolutePath = path.resolve(promptsDir, filePath);
        const dirPath = path.dirname(absolutePath);
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
        const content = getPromptContent(definition.template, definition.outputSchemaName, definition.useFetch);
        await fs.writeFile(absolutePath, content);
    }

    const { server, store: createdStore } = await createPromptServer({
      config: {
        rootDir: tempDir,
        promptsDir,
        schemaFile,
        plugins: [{ name: 'custom', createDataSource: () => ({ name: 'customSource', fetchData: async () => ({}) }) }],
        secrets: {
            GOOGLEAI_API_KEY: process.env.GOOGLEAI_API_KEY || 'test-key',
            GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || './fake-creds.json'
        }
      }
    });

    httpServer = server.listen(3031);
    store = createdStore;
  }, 30000); // Increase timeout for setup

  afterAll(async () => {
    if (httpServer) {
      httpServer.close();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create a dataprompt store with default options', () => {
    expect(store).toBeDefined();
    expect(store.routes.all().size).toBe(promptDefinitions.size);
    expect(store.flows.all().size).toBe(promptDefinitions.size);
    expect(store.registry.getDataSources().length).toBeGreaterThan(0);
  });

  it('should register a custom plugin', () => {
    const customSource = store.registry.getDataSource('customSource');
    expect(customSource).toBeDefined();
  });
});

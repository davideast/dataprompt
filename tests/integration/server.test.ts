import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DatapromptConfig, createPromptServer } from '../../src/index.js'
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { DatapromptPlugin } from '../../src/core/interfaces.js';
import type { Server } from 'http'
import * as fs from 'node:fs';
import { findUpSync, findUp } from 'find-up'

const MODEL = 'googleai/gemini-2.0-flash-exp'

// Set the rootDir to tests using the closest schema.js file above
// const currentFilePath = fileURLToPath(import.meta.url);
// const schemaFile = await findUp('schema.js', { cwd: path.dirname(currentFilePath) });
// const testRootDir = path.dirname(schemaFile!);

const testPromptContent = (
  options: {outputSchema: string} = {
    outputSchema: 'TestSchema'
  }
) => `---
model: ${MODEL}
output:
  schema: ${options.outputSchema}
---
This is a test prompt. Provide some random data and an explanation of this data.
`;

describe('Dataprompt Server Integration Tests', () => {
  let httpServer: Server;
  let tempDir: string;
  let testRootDir: string;

  beforeAll(() => {
    // Set the rootDir to main tests root
    const currentFilePath = fileURLToPath(import.meta.url);
    testRootDir = findUpSync('tests', { 
      cwd: path.dirname(currentFilePath),
      type: 'directory'
    })!;

    // Create a temporary directory for prompts
    tempDir = fs.mkdtempSync(path.resolve(testRootDir, 'dataprompt-test-'));
  });

  beforeEach(async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    // prompts dir needs to exist for dataprompt to run
    fs.mkdirSync(path.join(tempDir, 'prompts'), { recursive: true });
  });


  afterEach(() => {
    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true })
  });

  afterEach(() => {
    if (httpServer) {
      (httpServer as any).close();
      httpServer = null as any;
    }
  });

  afterAll(() => {
    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const setupStoreAndServer = async (
    config: DatapromptConfig = {
      rootDir: testRootDir
    }, 
    promptFiles: { [key: string]: string } = {}
  ) => {
    // Write prompt files to filesystem
    for (const filePath in promptFiles) {
      const absolutePath = path.join(tempDir, 'prompts', filePath);
      const dirPath = path.dirname(absolutePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(absolutePath, promptFiles[filePath]);
    }
    const { store, server } = await createPromptServer({
      config: {
        ...config,
        promptsDir: config.promptsDir || `${tempDir}/prompts`
      }
    });
    return { store, server };
  };

  // it('should create a dataprompt store with default options', async () => {
  //   const { store } = await setupStoreAndServer();
  //   expect(store).toBeDefined();
  //   expect(store.routes.all().size).toBe(0);
  //   expect(store.flows.all().size).toBe(0);
  //   expect(store.tasks.all().size).toBe(0);
  //   // has default plugins
  //   expect(store.registry.dataSources.length).toBeGreaterThan(0);
  // });

  // it('should register a custom plugin', async () => {
  //   function customPlugin(): DatapromptPlugin {
  //     return {
  //       name: 'custom',
  //       createDataSource: () => ({
  //         name: 'customSource',
  //         async fetchData() { return { data: 'test' }; }
  //       })
  //     };
  //   }

  //   const { store } = await setupStoreAndServer({
  //     plugins: [customPlugin()]
  //   });
  //   const provider = store.registry.getDataSource('customSource');

  //   expect(provider).toBeDefined()
  //   expect(provider.name).toBe('customSource');
  // });

  // it('should create a dataprompt server from the store', async () => {
  //   const { server } = await setupStoreAndServer();
  //   expect(server).toBeDefined();
  // });

  it('should serve a prompt and return a response', async () => {
    const testRoute = '/test';
    const promptFiles = { 'test.prompt': testPromptContent() };
    const { server } = await setupStoreAndServer(undefined, promptFiles);

    httpServer = server.listen(3022);
    const response = await request(server).get(testRoute);

    expect(response.status).toBe(200);
  });

//   it('should invoke the correct flow with params from the request URL', async () => {
//     // '/invoices/[id].prompt';
//     const promptContent = `---
// model: ${MODEL}
// output: 
//   schema: TestSchema
// ---
// Invoice ID: {{request.params.id}}`;
//     const promptFiles = { 'invoices/[id].prompt': promptContent };
//     const { server } = await setupStoreAndServer({}, promptFiles);

//     httpServer = server.listen(3021);
//     const response = await request(httpServer).get('/invoices/123');

//     expect(response.status).toBe(200);
//     expect(response.text).toContain('Invoice ID: 123');
//   });

//   it('should handle data inputs alongside URL parameters', async () => {
//     // '/items/[itemId].prompt';
//     const promptContent = `---
// model: ${MODEL}
// output: 
//   schema: TestSchema
// ---
// Item ID: {{request.params.itemId}}
// Data: {{data.name}}
// `;
//     const promptFiles = { 'items/[itemId].prompt': promptContent };
//     const { server } = await setupStoreAndServer({}, promptFiles);

//     httpServer = server.listen(3000);
//     const response = await request(httpServer).get('/items/456');

//     expect(response.status).toBe(200);
//     expect(response.text).toContain('Item ID: 456');
//     expect(response.text).toContain('Data: Test Item');
//   });
});

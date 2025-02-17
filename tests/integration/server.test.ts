import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { DatapromptConfig, createPromptServer } from '../../src/index.js'
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { DatapromptPlugin } from '../../src/core/interfaces.js';
import type { Server } from 'http'
import * as fs from 'node:fs';
import { findUpSync } from 'find-up'
import { DatapromptStore } from '../../src/core/dataprompt.js';
import { z } from 'genkit'
const MODEL = 'googleai/gemini-2.0-flash-exp';

// Only used to test the prompt request responses
export const TestSchema = z.object({
  data: z.string(),
  explanation: z.string(),
});

function prompt(options: {
  template: string;
  outputSchema?: {
    name: string,
    schema: z.ZodType,
  }
} = {
    template: 'This is a test prompt. Provide some random data and an explanation of this data.'
  },
) {
  const outputSchema = {
    name: options.outputSchema?.name ?? 'TestSchema',
    schema: options.outputSchema?.schema ?? TestSchema,
  };
  const template = `---
  model: ${MODEL}
  output:
    schema: ${outputSchema.name}
  ---
  ${options.template}
  `;
  return { template, outputSchema }
}

type PromptRequest = {
  prompt: {
    template: string;
    outputSchema: {
      name: string,
      schema: z.ZodType,
    }
  },
  context: [{
    url: string;
    toContain: string[];
  }];
};

function createPromptRequests() {
  const promptRequests = new Map<string, PromptRequest>();

  promptRequests.set('test.prompt', {
    prompt: prompt(),
    context: [{
      url: '/test',
      toContain: []
    }]
  });
  promptRequests.set('invoices/[id].prompt', {
    prompt: prompt({
      template: 'Invoice ID: {{request.params.id}}'
    }),
    context: [{
      url: '/invoices/123',
      toContain: ['123']
    }]
  });
  promptRequests.set('items/[uid]/[itemId].prompt', {
    prompt: prompt({
      template: `Say this exactly word for word: 
"This Item ID is {{request.params.itemId}} and this UID is {{request.params.uid}}"`
    }),
    context: [{
      url: '/items/david/456',
      toContain: ['456', 'david']
    }]
  });
  return promptRequests;
}

function createSchema() {
  return `import { z } from 'genkit';
export const TestSchema = z.object({
  data: z.string(),
  explanation: z.string(),
});
`;
}

function findTestRoot() {
  const currentFilePath = fileURLToPath(import.meta.url);
  return findUpSync('tests', {
    cwd: path.dirname(currentFilePath),
    type: 'directory'
  })!;
}

function customPlugin(): DatapromptPlugin {
  return {
    name: 'custom',
    createDataSource: () => ({
      name: 'customSource',
      async fetchData() { return { data: 'test' }; }
    })
  };
}

function writePromptFiles(params: {
  promptRequests: Map<string, PromptRequest>,
  promptsDir: string,
}) {
  const { promptRequests, promptsDir } = params;
  for (let [filePath, { prompt: { template } }] of promptRequests.entries()) {
    const absolutePath = path.resolve(promptsDir, filePath);
    const dirPath = path.dirname(absolutePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(absolutePath, template);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('dataprompt server & store', () => {
  // Set the rootDir to main /tests dir as the root
  const testRootDir = findTestRoot()
  // cleared out after all tests are run
  // probably not necessary but we do it anyways
  const promptRequests = createPromptRequests();
  const tasks = new Map<string, string>();  // no tasks yet

  // created before all tests are run
  // torn down after all tests are run
  let httpServer: Server;
  let tempDir: string;
  let promptsDir: string;
  let schemaFile: string;
  let store: DatapromptStore;

  beforeAll(async () => {
    // Create a temporary directory for prompts
    tempDir = fs.mkdtempSync(path.resolve(testRootDir, 'dataprompt-test-'));
    fs.mkdirSync(tempDir, { recursive: true });
    // prompts dir needs to exist for dataprompt to run
    promptsDir = fs.mkdirSync(path.join(tempDir, 'prompts'), { recursive: true })!;
    schemaFile = path.resolve(path.join(tempDir, 'schema.js'));
    // create schemaFile
    fs.writeFileSync(schemaFile, createSchema());
    const setup = await setupStoreAndServer({
      config: {
        rootDir: testRootDir,
        promptsDir,
        schemaFile,
        plugins: [
          customPlugin()
        ],
      }
    });
    httpServer = setup.server.listen(3031);
    store = setup.store;
  });

  afterAll(() => {
    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    promptRequests.clear();
    tasks.clear();
    if (httpServer) {
      (httpServer as any).close();
      httpServer = null as any;
    }
  });

  function setupStoreAndServer(params: {
    config: Required<Omit<DatapromptConfig, 'secrets' | 'genkit'>>
  }) {
    // Write prompt files to filesystem before starting the server
    writePromptFiles({ promptRequests, promptsDir })
    return createPromptServer({ config: params.config });
  }

  function requestIt(promptRequest: PromptRequest) {
    for (let { url, toContain } of promptRequest.context) {
      it(`should generate a response for ${url}`, async () => {
        const response = await request(httpServer).get(url);
        console.log(url, response.body)
        if(response.status === 429) {
          console.warn('Rate limit hit');
          return;
        }
        expect(response.status).toBe(200);
        if (toContain.length > 0) {
          for (let contains of toContain) {
            expect(response.text).toContain(contains);
          }
          if (response.body) {
            const parsed = promptRequest.prompt.outputSchema.schema.safeParse(response.body)
            expect(parsed.success).toBe(true);
            expect(parsed.data).toMatchObject(response.body)
          }
        }
      })
    }
  }

  it('should create a dataprompt store with default options', async () => {
    expect(store).toBeDefined();
    expect(store.routes.all().size).toBe(promptRequests.size);
    expect(store.flows.all().size).toBe(promptRequests.size);
    expect(store.tasks.all().size).toBe(tasks.size);
    // has default plugins
    expect(store.registry.dataSources.length).toBeGreaterThan(0);
  });

  it('should register a custom plugin', async () => {
    const provider = store.registry.getDataSource('customSource');
    expect(provider).toBeDefined()
    expect(provider.name).toBe('customSource');
  });

  it('should create a dataprompt server from the store', async () => {
    expect(httpServer).toBeDefined();
  });

  describe('prompt requests', async () => {
    for await (let request of promptRequests.values()) {
      requestIt(request);
      sleep(300)
    }
  });
});

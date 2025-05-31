import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { DatapromptConfig, createPromptServer } from '../../src/index.js'
import path from 'path';
import request from 'supertest';
import { DatapromptPlugin } from '../../src/core/interfaces.js';
import type { Server } from 'http'
import * as fs from 'node:fs';
import { DatapromptStore } from '../../src/core/dataprompt.js';
import { z } from 'genkit'
const MODEL = 'googleai/gemini-2.0-flash';
import { registerUserSchemas } from '../../src/utils/schema-loader.js'
import { findTestRoot, sleep } from '../utils.js'

// Only used to test the prompt request responses
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

function prompt(options: {
  template: string;
  outputSchema: {
    name: string,
    schema: z.ZodType,
  },
  useFetch: boolean;
} = {
    template: 'This is a test prompt. Provide some random data and an explanation of this data.',
    useFetch: false,
    outputSchema: {
      name: 'TestSchema',
      schema: TestSchema
    }
  },
) {
  const { outputSchema } = options;
  const baseTemplate = `---
model: ${MODEL}
output:
  schema: ${outputSchema.name}
---
${options.template}
`
  const fetchTemplate = `---
model: ${MODEL}
data.prompt:
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/1.json
output:
  schema: ${outputSchema.name}
---
${options.template}
`
  const template = options.useFetch ? fetchTemplate : baseTemplate;
  return { template, outputSchema }
}

type PromptRequest<Output = any> = {
  prompt: {
    template: string;
    outputSchema: {
      name: string,
      schema: Output,
    }
  },
  context: [{
    url: string;
    check: 'body' | 'text';
    toContain: Array<(body: Output) => boolean>;
  }];
};

function createPromptRequests() {
  const promptRequests = new Map<string, PromptRequest>();

  promptRequests.set('invoices/[id].prompt', {
    prompt: prompt({
      template: 'Invoice ID: {{request.params.id}}',
      useFetch: false,
      outputSchema: {
        name: 'TestSchema',
        schema: TestSchema
      }
    }),
    context: [{
      url: '/invoices/123',
      check: 'text',
      toContain: [
        (text: string) => text.includes('123')
      ]
    }]
  });
  promptRequests.set('items/[uid]/[itemId].prompt', {
    prompt: prompt({
      template: `Say this exactly word for word: 
"This Item ID is {{request.params.itemId}} and this UID is {{request.params.uid}}"`,
      useFetch: false,
      outputSchema: {
        name: 'TestSchema',
        schema: TestSchema
      }
    }),
    context: [{
      url: '/items/david/456',
      check: 'text',
      toContain: [
        (text: string) => text.includes('456'),
        (text: string) => text.includes('david')
      ]
    }]
  });
  promptRequests.set('hn/home.prompt', {
    prompt: prompt({
      template: `Provide me the top 3 stories from Hacker News \n\n{{json news}}`,
      useFetch: true,
      outputSchema: {
        name: 'HNSchema',
        schema: HNSchema
      }
    }),
    context: [{
      url: '/hn/home',
      check: 'body',
      toContain: [
        (output: z.infer<typeof HNSchema>) => output.topThree.length === 3
      ]
    }]
  })
  promptRequests.set('test/parts.prompt', {
    prompt: prompt({
      template: `{{role "system"}}\n You are a pirate. Talk like one. IMPORTANT: Start your response by telling the user "Arg, I'm a pirate!" in the very first sentence in your response before following the user's request. \n {{role "user"}} \n\nMy name is David, give me my pirate name."`,
      useFetch: false,
      outputSchema: {
        name: 'TestSchema',
        schema: TestSchema
      }
    }),
    context: [{
      url: '/test/parts',
      check: 'text',
      toContain: [
        (text: string) => text.includes('pirate'),
      ]
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

export const HNSchema = z.object({
  topThree: z.array(z.object({
    title: z.string(),
    url: z.string(),
  }))
});
`;
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

describe('dataprompt server & store', () => {
  // Set the rootDir to main /tests dir as the root
  const testRootDir = findTestRoot(import.meta.url)
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
    for (let { url, toContain, check } of promptRequest.context) {
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
            expect(contains(response[check])).toBe(true);
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

  it('should have the fetch plugin by default', () => {
    const provider = store.registry.getDataSource('fetch');
    expect(provider).toBeDefined()
    expect(provider.name).toBe('fetch');
  })

  it('should create a dataprompt server from the store', async () => {
    expect(httpServer).toBeDefined();
  });

  it('should register and resolve schemas', async () => {
    const userSchemas = await registerUserSchemas({
      genkit: store.ai,
      schemaFile: schemaFile,
      rootDir: testRootDir,
    })
    expect(userSchemas.get('TestSchema')).toBeDefined()
    expect(userSchemas.get('HNSchema')).toBeDefined()
  });

  describe('prompt requests', async () => {
    for await (let request of promptRequests.values()) {
      requestIt(request);
    }
  });
});

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { resolveConfig, validateSecrets } from '../src/core/config.js'
import path from 'path';
import { DatapromptPlugin } from '../src/core/interfaces.js';
import { findTestRoot } from './utils.js'

describe('dataprompt config', () => {
  const testRoot = findTestRoot(import.meta.url);

  it('should resolve a default config', async () => {
    process.env.GOOGLEAI_API_KEY = 'hardcodedset';
    const config = await resolveConfig({
      providedConfig: {
        rootDir: testRoot
      }
    })
    expect(config.secrets.GOOGLEAI_API_KEY).toEqual('hardcodedset');
    expect(config.rootDir).toEqual(testRoot);
    expect(config.schemaFile).toEqual(`${testRoot}/schema.ts`);
    expect(config.genkit).toBeDefined();
    expect(config.plugins).toEqual([]);
    expect(config.promptsDir).toEqual(`${testRoot}/prompts`);
  });

  it('should resolve a default config with a inline secret', async () => {
    const config = await resolveConfig({
      providedConfig: {
        rootDir: testRoot,
        secrets: {
          GOOGLEAI_API_KEY: 'test',
        }
      }
    })
    expect(config.secrets.GOOGLEAI_API_KEY).toEqual('test');
    expect(config.rootDir).toEqual(testRoot);
    expect(config.schemaFile).toEqual(`${testRoot}/schema.ts`);
    expect(config.genkit).toBeDefined();
    expect(config.promptsDir).toEqual(`${testRoot}/prompts`);
  });

  it('should resolve a default config with non-standard schema file', async () => {
    const config = await resolveConfig({
      providedConfig: {
        rootDir: testRoot,
        schemaFile: path.resolve(testRoot, 'schemas', 'index.ts'),
        secrets: {
          GOOGLEAI_API_KEY: 'blah',
        }
      }
    })
    expect(config.secrets.GOOGLEAI_API_KEY).toEqual('blah');
    expect(config.rootDir).toEqual(testRoot);
    expect(config.schemaFile).toEqual(`${testRoot}/schemas/index.ts`);
  });

  it('should resolve a default config with non-standard prompts file', async () => {
    const config = await resolveConfig({
      providedConfig: {
        rootDir: testRoot,
        promptsDir: path.resolve(testRoot, 'system', 'prompts'),
        secrets: {
          GOOGLEAI_API_KEY: 'blah',
        }
      }
    })
    expect(config.secrets.GOOGLEAI_API_KEY).toEqual('blah');
    expect(config.rootDir).toEqual(testRoot);
    expect(config.genkit).toBeDefined();
    expect(config.plugins).toEqual([]);
    expect(config.promptsDir).toEqual(`${testRoot}/system/prompts`);
  });
  

})
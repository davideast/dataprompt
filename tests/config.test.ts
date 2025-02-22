import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { resolveConfig, validateSecrets } from '../src/core/config.js'
import path from 'path';
import { DatapromptPlugin, createPluginSchema } from '../src/core/interfaces.js';
import { findTestRoot } from './utils.js'
import { z } from 'genkit';

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
      }
    })
    expect(config.schemaFile).toEqual(`${testRoot}/schemas/index.ts`);
  });

  it('should resolve a default config with non-standard prompts file', async () => {
    const config = await resolveConfig({
      providedConfig: {
        rootDir: testRoot,
        promptsDir: path.resolve(testRoot, 'system', 'prompts')
      }
    })
    expect(config.promptsDir).toEqual(`${testRoot}/system/prompts`);
  });

  const TestPluginConfigSchema = z.object({
    secrets: z.object({
      TEST: z.string().min(1)
    }).passthrough()
  })

  type TestPluginConfig = {
    secrets?: {
      TEST?: string;
    }
  };

  function customPlugin(config?: TestPluginConfig): DatapromptPlugin<{
    config: TestPluginConfig;
    schema: typeof TestPluginConfigSchema;
  }> {
    const secrets = config?.secrets ?? {}
    return {
      name: 'test',
      provideConfig() {
        return {
          config: { secrets },
          schema: createPluginSchema(TestPluginConfigSchema)
        }
      }
    }
  }

  // it('should should resolve a config with a plugin and provided secret', async () => {
  //   const config = await resolveConfig({
  //     providedConfig: {
  //       rootDir: testRoot,
  //       plugins: [ customPlugin({ secrets: { TEST: 'test' } }) ]
  //     }
  //   })
  //   expect(config.secrets.TEST).toEqual('test');
  // });

})
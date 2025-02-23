import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/core/config.js'
import { DatapromptPlugin } from '../src/core/interfaces.js';
import { findTestRoot } from './utils.js'
import { z } from 'genkit';
import path from 'path';

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
    delete process.env.GOOGLEAI_API_KEY;
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
        secrets: {
          GOOGLEAI_API_KEY: 'test',
        },
        schemaFile: path.resolve(testRoot, 'schemas', 'index.ts'),
      }
    })
    expect(config.schemaFile).toEqual(`${testRoot}/schemas/index.ts`);
  });

  it('should resolve a default config with non-standard prompts file', async () => {
    const config = await resolveConfig({
      providedConfig: {
        rootDir: testRoot,
        secrets: {
          GOOGLEAI_API_KEY: 'test',
        },
        promptsDir: path.resolve(testRoot, 'system', 'prompts')
      }
    })
    expect(config.promptsDir).toEqual(`${testRoot}/system/prompts`);
  });

  const TestPluginSecretsSchema = z.object({
    TEST: z.string().min(1)
  })

  type TestPluginSecrets = typeof TestPluginSecretsSchema;

  type TestPluginConfig = {
    secrets?: z.infer<typeof TestPluginSecretsSchema>
  };

  function customPlugin(config?: TestPluginConfig): DatapromptPlugin<TestPluginSecrets> {
    const secrets = config?.secrets ?? {}
    return {
      name: 'test',
      provideSecrets() {
        return {
          secrets: { T}
          schema: TestPluginSecretsSchema
        }
      }
    }
  }

  it('should should resolve a config with a plugin and provided secret', async () => {
    const config = await resolveConfig({
      providedConfig: {
        secrets: { GOOGLEAI_API_KEY: 'test' },
        rootDir: testRoot,
        plugins: [ 
          customPlugin({ 
            secrets: { TEST: 'test' }
          })
        ]
      }
    })
    expect(config.secrets.TEST).toEqual('test');
  })

  it('should throw an error when a plugin secret is missing', async () => {
    try {
      await resolveConfig({
        providedConfig: {
          rootDir: testRoot,
          plugins: [ 
            customPlugin()
          ]
        }
      })
      expect(resolveConfig).toThrow()
    } catch(error: z.ZodError | any) {
      expect((error as z.ZodError).errors.length).toBeGreaterThan(1);
    }
  })

})

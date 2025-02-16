import { z } from 'zod';
import { genkit, Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { dateFormat } from '../utils/helpers/date-format.js';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pathToFileURL } from 'url';
import { findUp } from 'find-up';
import { DatapromptPlugin } from './interfaces.js';
import * as NodeFS from 'node:fs';

const fileExistsAsync = promisify(fs.exists);

const SecretsSchema = z.object({
  GOOGLEAI_API_KEY: z.string().min(1),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1),
});

export type DatapromptSecrets = z.infer<typeof SecretsSchema>;

export type DatapromptConfig = {
  genkit?: Genkit;
  plugins?: DatapromptPlugin[];
  promptsDir?: string;
  schemaFile?: string;
  secrets?: DatapromptSecrets;
  rootDir: string;
};

let aiInstance: Genkit | null = null;
let _secrets: DatapromptSecrets | null = null;

export function loadSecrets(secrets: DatapromptSecrets): DatapromptSecrets {
  try {
    const parsedSecrets = SecretsSchema.parse(secrets);
    _secrets = parsedSecrets;
    return parsedSecrets;
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw error;
  }
}

async function loadConfigFile(configPath: string): Promise<DatapromptConfig> {
  try {
    const importedConfig = await import(pathToFileURL(configPath).toString());
    if (!importedConfig.default) {
      throw new Error(`Config file at ${configPath} must have a default export.`);
    }
    return importedConfig.default;
  } catch (error: any) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND') {
      return null as any;
    }
    throw new Error(`Error loading config file at ${configPath}: ${error.message}`, { cause: error });
  }
}

export async function resolveConfig(
  providedConfig?: Partial<DatapromptConfig>
): Promise<Omit<Required<DatapromptConfig>, 'secrets'>> {
  let userConfig: DatapromptConfig | null = null;
  const configFilenames = ['dataprompt.config.ts', 'dataprompt.config.js'];
  let rootDir: string | undefined;

  const packageJsonPath = await findUp('package.json', { cwd: process.cwd() });
  if (packageJsonPath) {
    rootDir = path.dirname(packageJsonPath);
  } else {
    throw new Error('Could not find package.json in the current directory or any parent directories.')
  }

  if (rootDir) {
    for (const filename of configFilenames) {
      const configPath = path.join(rootDir, filename);
      if (await fileExistsAsync(configPath)) {
        userConfig = await loadConfigFile(configPath);
        if (userConfig) break;
      }
    }
  }

  const defaultConfig: Required<Omit<DatapromptConfig, 'genkit' | 'secrets' | 'rootDir'>> = {
    plugins: [],
    promptsDir: 'prompts',
    schemaFile: 'schema.js'
  };

  const secretConfig = userConfig?.secrets ?? providedConfig?.secrets ?? process.env as any;
  const secrets = loadSecrets(secretConfig);

  /*
   * Load order precedence:
   * 1. `userConfig`: From `dataprompt.config.{ts,js}` in project root (found w/ `find-up`).
   * 2. `providedConfig`: Passed to `resolveConfig`.
   * 3. `defaultConfig`: Built-in defaults.
   * 4. `getGenkit()`: Fallback for `genkit` only (if not in `userConfig` or `providedConfig`).
   */
  const mergedConfig: Required<DatapromptConfig> = {
    genkit: userConfig?.genkit ?? providedConfig?.genkit ?? getGenkit(),
    plugins: userConfig?.plugins ?? providedConfig?.plugins ?? defaultConfig.plugins,
    promptsDir: userConfig?.promptsDir ?? providedConfig?.promptsDir ?? defaultConfig.promptsDir,
    schemaFile: userConfig?.schemaFile ?? providedConfig?.schemaFile ?? defaultConfig.schemaFile,
    secrets,
    rootDir,
  };

  return mergedConfig;
}

function getSecrets(secrets?: DatapromptSecrets) {
  if (!_secrets) {
    _secrets = loadSecrets(secrets || process.env as DatapromptSecrets);
  }
  return _secrets;
}

export function getGenkit({ provider, secrets }: { 
  provider?: string; 
  secrets?: DatapromptSecrets 
} = { provider: 'googleai' }) {
  if (!aiInstance) {
    const { GOOGLEAI_API_KEY: apiKey } = getSecrets();
    if (!apiKey) {
      throw new Error(`API key for provider "${provider}" not found in environment variables.  Make sure GOOGLEAI_API_KEY is set.`);
    }
    aiInstance = genkit({
      plugins: [
        googleAI({ apiKey })
      ],
    });
    aiInstance.defineHelper('dateFormat', dateFormat);
  }
  return aiInstance;
}

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

const fileExistsAsync = promisify(fs.exists);

export type DatapromptConfig = {
  genkit?: Genkit;
  plugins?: DatapromptPlugin[];
  promptsDir?: string;
  schemaFile?: string;
};
const KeysSchema = z.object({
  GOOGLEAI_API_KEY: z.string().min(1),
});

type Keys = z.infer<typeof KeysSchema>;

let keys: Keys | undefined;
let aiInstance: Genkit | null = null;

export function loadKeys() {
  try {
    keys = KeysSchema.parse(process.env);
  } catch (error) {
    console.error("Error: Invalid environment variables.", error);
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
  return keys;
}

export function getKeys() {
  if (!keys) {
    loadKeys();
  }
  return keys;
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
): Promise<Required<DatapromptConfig>> {``
  let userConfig: DatapromptConfig | null = null;
  const configFilenames = ['dataprompt.config.ts', 'dataprompt.config.js'];
  let projectRoot: string | undefined;

  const packageJsonPath = await findUp('package.json', { cwd: process.cwd() });
  if (packageJsonPath) {
    projectRoot = path.dirname(packageJsonPath);
  }

  if (projectRoot) {
    for (const filename of configFilenames) {
      const configPath = path.join(projectRoot, filename);
      if (await fileExistsAsync(configPath)) {
        userConfig = await loadConfigFile(configPath);
        if (userConfig) break;
      }
    }
  }

  const defaultConfig: Required<Omit<DatapromptConfig, 'genkit'>> = {
    plugins: [],
    promptsDir: 'prompts',
    schemaFile: 'schema.js',
};

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
  };

  return mergedConfig;
}

export function getGenkit(provider: string = 'googleai') {
  if (!aiInstance) {
    const loadedKeys = getKeys();
    // Check if loadedKeys is defined before accessing its properties:
    if (!loadedKeys) {
      throw new Error("Environment variables not loaded. Make sure GOOGLEAI_API_KEY is set.");
    }
    const apiKey = loadedKeys.GOOGLEAI_API_KEY;

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

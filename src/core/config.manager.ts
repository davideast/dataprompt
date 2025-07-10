import * as path from 'path';
import { z } from 'genkit';
import { findUp } from 'find-up';
import { DatapromptPlugin } from './interfaces.js';
import { DatapromptUserConfig, DatapromptConfig } from './config.js';
import { firestorePlugin } from '../plugins/firebase/public.js';
import { schedulerPlugin } from '../plugins/scheduler/index.js';
import { fetchPlugin } from '../plugins/fetch/index.js';
import { pathToFileURL } from 'node:url';

const CoreSecretsSchema = z.object({
  GOOGLEAI_API_KEY: z.string().min(1, { message: 'GOOGLEAI_API_KEY is required.' }),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1, { message: 'GOOGLE_APPLICATION_CREDENTIALS is required.' }),
}).passthrough();

type PluginSecrets = {
  plugin: DatapromptPlugin;
  secrets: Record<string, any>;
  schema?: z.AnyZodObject;
};

export class ConfigManager {
  #projectRoot: string;

  constructor(options?: { projectRoot?: string }) {
    this.#projectRoot = options?.projectRoot || process.cwd();
  }

  async load(): Promise<DatapromptConfig> {
    const userConfig = await this.#loadUserConfigFromFile();
    const config = await this.#resolve(userConfig);
    return config;
  }

  #resolve = async (userConfig?: DatapromptUserConfig): Promise<DatapromptConfig> => {
    const rootDir = await this.#resolveRootDir(userConfig);
    const defaultConfig: DatapromptConfig = {
      plugins: [],
      promptsDir: 'prompts',
      schemaFile: 'schema.ts',
      secrets: {
        GOOGLEAI_API_KEY: process.env.GOOGLEAI_API_KEY,
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      },
      rootDir,
    };

    // THIS IS THE KEY FIX: Perform an explicit and correct merge.
    const mergedConfig: DatapromptConfig = {
        ...defaultConfig,
        ...userConfig, // This will shallow-overwrite promptsDir, etc. which is what we want.
        secrets: {
            ...defaultConfig.secrets,    // Start with default secrets...
            ...userConfig?.secrets,      // ...then merge user's secrets over them.
        },
    };

    // Now resolve paths based on the final rootDir
    mergedConfig.promptsDir = path.resolve(rootDir, mergedConfig.promptsDir);
    mergedConfig.schemaFile = path.resolve(rootDir, mergedConfig.schemaFile);
    
    // Resolve plugins based on the potentially overridden plugins array.
    mergedConfig.plugins = this.#resolvePlugins(userConfig?.plugins);

    // Validate the final, fully merged secrets object.
    this.#validateSecrets(mergedConfig);
    
    return mergedConfig;
  }

  #loadUserConfigFromFile = async (): Promise<DatapromptUserConfig | undefined> => {
    const configPath = await findUp('dataprompt.config.js', { cwd: this.#projectRoot });
    if (!configPath) return undefined;
    try {
      const userModule = await import(pathToFileURL(configPath).toString());
      return userModule.default;
    } catch (e: any) {
      throw new Error(`Failed to load or parse dataprompt.config.js at '${configPath}': ${e.message}`);
    }
  }

  #resolveRootDir = async (userConfig?: DatapromptUserConfig): Promise<string> => {
    if (userConfig?.rootDir) return path.resolve(this.#projectRoot, userConfig.rootDir);
    const packageJsonPath = await findUp('package.json', { cwd: this.#projectRoot });
    return packageJsonPath ? path.dirname(packageJsonPath) : this.#projectRoot;
  }

  #resolvePlugins = (userPlugins: DatapromptPlugin[] = []): DatapromptPlugin[] => {
    const plugins = [...userPlugins];
    if (!plugins.some(p => p.name === 'firestore')) plugins.push(firestorePlugin());
    if (!plugins.some(p => p.name === 'fetch')) plugins.push(fetchPlugin());
    if (!plugins.some(p => p.name === 'schedule')) plugins.push(schedulerPlugin());
    return plugins;
  }

  // This method now only validates and throws on error. It does not return a value.
  #validateSecrets = (config: Partial<DatapromptConfig>): void => {
    let validationSchema = CoreSecretsSchema;
    const allPluginSecrets = config.plugins?.map(p => p.provideSecrets ? p.provideSecrets() : undefined)
                                       .filter((s): s is PluginSecrets => !!s);
    for (const { schema } of allPluginSecrets || []) {
      if (schema) validationSchema = validationSchema.merge(schema);
    }
    try {
      validationSchema.parse(config.secrets || {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
        throw new Error(`Configuration secret validation failed:\n${errorMessages}`);
      }
      throw error;
    }
  }
}
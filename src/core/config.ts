import * as path from 'path';
import { z } from 'zod';
import { genkit, GenkitBeta as Genkit } from 'genkit/beta';
import { googleAI } from '@genkit-ai/googleai';
import { dateFormat } from '../utils/helpers/date-format.js';
import { pathToFileURL } from 'url';
import { findUp } from 'find-up';
import { BaseConfig, BaseConfigSchema, DatapromptPlugin } from './interfaces.js';

const SecretsSchema = z.object({
  GOOGLEAI_API_KEY: z.string().min(1),
  // GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1),
}).partial();

export type DatapromptSecrets = z.infer<typeof SecretsSchema>;

export type DatapromptConfig = {
  genkit?: Genkit;
  plugins?: DatapromptPlugin[];
  promptsDir?: string;
  schemaFile?: string;
  secrets?: DatapromptSecrets;
  rootDir?: string;
};

let aiInstance: Genkit | null = null;
let _secrets: DatapromptSecrets | null = null;

export function validateSecrets(params: {
  secrets: BaseConfig['secrets'],
  pluginConfigs?: PluginConfig[],
}) {
  const { secrets, pluginConfigs } = params;
  let validationSchema = SecretsSchema.passthrough();
  let pluginSecrets: Record<string, any> = {};

  if (pluginConfigs != null) {
    for (const { schema } of pluginConfigs) {
      if (schema) {
        validationSchema = validationSchema.merge(schema);
      }
    }
    pluginSecrets = Object.assign(
      {}, 
      ...pluginConfigs.map((config) => config.config.secrets)
    );
  }

  const configuredSecrets = {
    ...secrets,
    ...pluginSecrets,
  };

  // console.log({ configuredSecrets })

  try {
    const parsedSecrets = validationSchema.parse(configuredSecrets);
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

export async function resolveConfig(params: {
  providedConfig?: Partial<DatapromptConfig>,
}): Promise<Required<DatapromptConfig>> {
  const { providedConfig } = params;
  const userConfig = await findDatapromptUserConfig();
  const rootDir = userConfig?.rootDir ??
    providedConfig?.rootDir ??
    await findProjectRootByPackageJson();

  const pluginConfigs = [
    getPluginConfigs(userConfig),
    getPluginConfigs(providedConfig)
  ].flat();
  const secrets = resolveSecrets({
    userConfig,
    providedConfig,
    defaultConfig: { secrets: process.env as any },
    pluginConfigs,
  });

  const defaultConfig: Required<DatapromptConfig> = {
    // TODO(davideast): refactor getGenkit() wait until plugins are initialized
    plugins: [],
    // dir name is resolved to root of package.json
    promptsDir: 'prompts',
    // schema file is resolved to root of package.json
    // but the built .js not .ts version.
    schemaFile: 'schema.ts',
    genkit: getGenkit(),
    secrets: process.env as any,
    // root is decided by user config or package.json
    rootDir,
  };

  const genkit = userConfig?.genkit ??
    providedConfig?.genkit ??
    defaultConfig.genkit;

  const schemaFile = resolveSchemaFile({
    rootDir,
    userConfig,
    providedConfig,
    defaultConfig,
  });

  const promptsDir = resolvePromptsDir({
    rootDir,
    userConfig,
    providedConfig,
    defaultConfig,
  });

  const plugins = userConfig?.plugins ??
    providedConfig?.plugins ??
    defaultConfig.plugins;

  /*
   * Load order precedence:
   * 1. `userConfig`: From `dataprompt.config.{ts,js}` in project root (found w/ `find-up`).
   * 2. `providedConfig`: Passed to `resolveConfig`.
   * 3. `defaultConfig`: Built-in defaults.
   * 4. `getGenkit()`: Fallback for `genkit` only (if not in `userConfig` or `providedConfig`).
   */
  return {
    schemaFile,
    genkit,
    plugins,
    promptsDir,
    secrets,
    rootDir,
  };
}

type PluginConfig = {
  plugin: DatapromptPlugin;
  config: BaseConfig;
  schema?: typeof BaseConfigSchema;
}

function getPluginConfigs(config: Partial<DatapromptConfig> | undefined): Required<PluginConfig[]> {
  const pluginConfigs: PluginConfig[] = [];
  const plugins = config?.plugins ?? [];
  for (const plugin of plugins) {
    if (plugin.provideConfig) {
      const { config, schema } = plugin.provideConfig();
      // Check if is ZodObject
      if (!(schema instanceof z.ZodObject)) {
        console.warn(`Plugin ${plugin.name} did not return a ZodObject from provideConfig. Skipping.`);
        continue;
      }
      if ('secrets' in schema.shape && schema.shape.secrets instanceof z.ZodObject) {
        pluginConfigs.push({ plugin, config, schema })
      }
    }
  }
  return pluginConfigs
}

async function findProjectRootByPackageJson() {
  const packageJsonPath = await findUp('package.json', { cwd: process.cwd() });
  if (packageJsonPath) {
    return path.dirname(packageJsonPath);
  } else {
    throw new Error('Could not find package.json in the current directory or any parent directories.');
  }
}

async function findDatapromptUserConfig() {
  const userConfigPath = await findUp('dataprompt.config.js', { cwd: process.cwd() });
  if (userConfigPath != null) {
    return await loadConfigFile(userConfigPath);
  }
}

function resolveSecrets(params: {
  userConfig?: Partial<DatapromptConfig>,
  providedConfig?: Partial<DatapromptConfig>,
  defaultConfig: Partial<DatapromptConfig>,
  pluginConfigs: PluginConfig[],
}) {
  const { userConfig, providedConfig, defaultConfig, pluginConfigs } = params;
  // const secrets = userConfig?.secrets ??
  //   providedConfig?.secrets ??
  //   defaultConfig.secrets;

  const secrets = {
    ...defaultConfig.secrets,
    ...providedConfig?.secrets,
    ...userConfig?.secrets,
  };

  console.log(`
  
    SECRETS:

    ${JSON.stringify(secrets, null, 2)}
  
  `)
  console.log({ secrets })

  return validateSecrets({
    secrets,
    pluginConfigs,
  });
}

function resolveSchemaFile(params: {
  rootDir: string;
  userConfig?: Partial<DatapromptConfig>,
  providedConfig?: Partial<DatapromptConfig>,
  defaultConfig: Required<DatapromptConfig>,
}): string {
  const schemaFile = params.userConfig?.schemaFile ??
    params.providedConfig?.schemaFile ??
    params.defaultConfig.schemaFile;
  if (!schemaFile) {
    throw new Error("Schema file path is missing in configuration.");
  }
  try {
    return path.resolve(params.rootDir, schemaFile);
  } catch (error) {
    console.error("Error resolving schema path:", error);
    throw error;
  }
}

function resolvePromptsDir(params: {
  rootDir: string;
  userConfig?: Partial<DatapromptConfig>,
  providedConfig?: Partial<DatapromptConfig>,
  defaultConfig: Required<DatapromptConfig>,
}): string {
  const promptsDir = params.userConfig?.promptsDir ??
    params.providedConfig?.promptsDir ??
    params.defaultConfig.promptsDir;
  if (!promptsDir) {
    throw new Error("prompts directory is missing in configuration.");
  }
  try {
    return path.resolve(params.rootDir, promptsDir);
  } catch (error) {
    console.error("Error resolving prompts directory:", error);
    throw error;
  }
}

function getSecrets() {
  if (!_secrets) {
    // Will throw an error telling the user what secrets 
    // are required given the plugin configuration
    _secrets = validateSecrets({ secrets: {} })
  }
  return _secrets;
}

export function getGenkit({ provider }: Partial<{
  provider: string;
}> = { provider: 'googleai' }) {
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


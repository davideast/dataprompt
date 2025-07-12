import yaml from 'js-yaml';
import { SchemaMap } from './schema-loader.js';
import { PluginManager } from '../core/plugin.manager.js'; // Import the new manager
import { PromptConfig as PromptMetadata } from 'genkit';

export interface PromptFile {
  template: string;
  options: Partial<PromptMetadata>;
  data: {
    prompt: {
      sources?: Record<string, Record<string, any>>;
      result?: Record<string, Record<string, any>>;
      trigger?: Record<string, any>;
    };
  };
}

/**
 * Extracts YAML frontmatter and the prompt template from a .prompt file string.
 * It also validates the defined sources and actions against the registered plugins.
 * @param fileContents The raw string content of the .prompt file.
 * @param userSchemas A map of registered Zod schemas.
 * @param pluginManager The application's central PluginManager instance.
 */
export async function extractYAML(
  fileContents: string,
  userSchemas: SchemaMap,
  pluginManager: PluginManager // Updated from 'registry: PluginRegistry'
): Promise<PromptFile> {
  try {
    if (!fileContents.includes('---')) {
      return {
        template: fileContents,
        options: {},
        data: {
          prompt: {},
        },
      };
    }

    const parts = fileContents.split('---');
    const frontmatter = parts[1];
    const template = parts[2]?.trim() ?? ''; // Ensure template is not undefined

    const yamlData = yaml.load(frontmatter);

    if (isPlainObject(yamlData)) {
      const {
        ['data.prompt']: promptData,
        ...options
      } = yamlData;

      if (promptData && !isPlainObject(promptData)) {
        throw new Error('data.prompt must be an object');
      }

      // Validate sources using the PluginManager
      if (promptData?.sources) {
        if (!isPlainObject(promptData.sources)) {
          throw new Error('sources must be an object');
        }
        for (const sourceName of Object.keys(promptData.sources)) {
          // This will throw a descriptive error if the provider is not found.
          pluginManager.getDataSource(sourceName); 
        }
      }

      // Validate result actions using the PluginManager
      if (promptData?.result) {
        if (!isPlainObject(promptData.result)) {
          throw new Error('result must be an object');
        }
        for (const actionName of Object.keys(promptData.result)) {
          // This will throw a descriptive error if the provider is not found.
          pluginManager.getAction(actionName);
        }
      }
      
      // Schema resolution logic 
      if (
        isPlainObject(options.output) &&
        typeof options.output.schema === 'string'
      ) {
        const schemaName = options.output.schema;
        const resolvedSchema = userSchemas.get(schemaName);
        if (resolvedSchema) {
          options.output.schema = resolvedSchema;
        } else {
          console.warn(
            `Schema ${schemaName} not found. Available schemas: ${[...userSchemas.keys()].join(', ')}`
          );
        }
      }

      return {
        template,
        options,
        data: {
          prompt: promptData || {}
        }
      };
    }

    return {
      template,
      options: {},
      data: {
        prompt: {}
      }
    };

  } catch (e: any) {
    throw e;
  }
}

function isPlainObject(value: any): value is Record<string, any> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    value.constructor === Object
  );
}

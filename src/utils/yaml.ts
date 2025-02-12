import yaml from 'js-yaml';
import { SchemaMap } from './schema-loader.js';
import { PluginRegistry } from '../core/registry.js';
import { PromptMetadata } from 'genkit';

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

export async function extractYAML(
  fileContents: string,
  userSchemas: SchemaMap,
  registry: PluginRegistry
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
    const template = parts[2].trim();

    const yamlData = yaml.load(frontmatter);

    if (isPlainObject(yamlData)) {
      const {
        ['data.prompt']: promptData,
        ...options
      } = yamlData;

      if (promptData && !isPlainObject(promptData)) {
        throw new Error('data.prompt must be an object');
      }

      // Validate sources
      if (promptData?.sources) {
        if (!isPlainObject(promptData.sources)) {
          throw new Error('sources must be an object');
        }

        // Validate each source is registered
        for (const sourceName of Object.keys(promptData.sources)) {
          try {
            registry.getDataSource(sourceName); // This throws if not found
          } catch (e) {
            const available = Array.from(registry.dataSources);
            throw new Error(
              `Unknown data source: "${sourceName}". ` +
              (available.length > 0
                ? `Available sources: ${available.join(', ')}`
                : 'No data sources registered.')
            );
          }
        }
      }

      // Validate result actions
      if (promptData?.result) {
        if (!isPlainObject(promptData.result)) {
          throw new Error('result must be an object');
        }

        // Validate each action is registered
        for (const actionName of Object.keys(promptData.result)) {
          try {
            registry.getAction(actionName); // This throws if not found
          } catch (e) {
            const available = Array.from(registry.actions);
            throw new Error(
              `Unknown action: "${actionName}". ` +
              (available.length > 0
                ? `Available actions: ${available.join(', ')}`
                : 'No actions registered.')
            );
          }
        }
      }

      // Handle schema resolution like before
      if (
        isPlainObject(options.output) &&
        typeof options.output.schema === 'string'
      ) {
        const schemaName = options.output.schema;
        const resolvedSchema = userSchemas[schemaName];
        if (resolvedSchema) {
          options.output.schema = resolvedSchema;
        } else {
          console.warn(
            `Schema ${schemaName} not found in user schemas. Available schemas: ${Object.keys(userSchemas).join(', ')}`
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
    value.constructor === Object &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

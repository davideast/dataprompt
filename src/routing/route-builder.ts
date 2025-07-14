import { Genkit, z } from 'genkit';
import { DatapromptFile } from '../core/interfaces.js';
import { PluginManager } from '../core/plugin.manager.js';
import { SchemaMap } from '../utils/schema-loader.js';
import { DatapromptRoute } from './server.js';
import { createPromptFlow, FlowDefinition, FlowInputSchema } from './flow-builder.js';
import { extractYAML } from '../utils/yaml.js';

export async function createRoute(params: {
  ai: Genkit;
  file: DatapromptFile;
  userSchemas: SchemaMap;
  expressRoute: string;
  pluginManager: PluginManager;
  rootDir: string;
}): Promise<DatapromptRoute> {
  const { ai, file, userSchemas, expressRoute, pluginManager, rootDir } = params;

  const promptFile = await extractYAML(file.content, userSchemas, pluginManager);
  
  const promptMetadata = promptFile.options;

  if (!promptMetadata.input) {
    promptMetadata.input = {
      schema: z.object({})
    }
  }
  promptMetadata.input.schema = FlowInputSchema;

  const flowName = file.path.replace(/[\/\[\]]/g, '_').replace(/^_/, '');

  // Handle both a string name and a pre-resolved Zod schema.
  let outputSchema: z.ZodType | undefined;
  const schemaFromMeta = promptMetadata.output?.schema;

  if (typeof schemaFromMeta === 'string') {
    // If it's a string, look it up in the map.
    outputSchema = userSchemas.get(schemaFromMeta);
  } else if (typeof schemaFromMeta === 'object' && schemaFromMeta?._def) {
    // If it's an object that looks like a Zod schema, use it directly.
    outputSchema = schemaFromMeta as z.ZodType;
  }

  // TODO(davideast): Consider hiding FlowDefinition into an absraction
  const flowDef: FlowDefinition = {
    name: flowName,
    routePath: file.path,
    promptMetadata,
    outputSchema,
    data: promptFile.data,
    template: promptFile.template,
  };

  const callableFlow = createPromptFlow({
    ai,
    flowDef,
    pluginManager,
    file
  });

  return {
    promptFilePath: file.path,
    flow: callableFlow,
    flowDef,
    nextRoute: file.nextRoute,
    expressRoute,
  };
}

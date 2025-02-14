import { Genkit, z } from 'genkit';
import { RequestContextSchema, DatapromptFile } from '../core/interfaces.js';
import { PluginRegistry } from '../core/registry.js';
import { extractYAML } from '../utils/yaml.js';
import { SchemaMap } from '../utils/schema-loader.js';
import { DatapromptRoute } from './server.js';
import { createPromptFlow, FlowDefinition } from './flow-builder.js';

export async function createRoute(params: {
  ai: Genkit;
  file: DatapromptFile;
  userSchemas: SchemaMap;
  expressRoute: string;
  registry: PluginRegistry;
}): Promise<DatapromptRoute> {
  const { ai, file, userSchemas, expressRoute, registry } = params;
  const { path: routePath, content: fileContent, nextRoute } = file;
  const extracted = await extractYAML(fileContent, userSchemas, registry);
  const { data, options, template } = extracted;

  // replace / with _ for flow names not to break the genkit registry
  const flowName = routePath.replace(/[\/\[\]]/g, '_').replace(/^_/, '');

  const inputSchema = z.object({
    request: RequestContextSchema,
  });

  const outputSchema = options.output?.schema || z.string();

  // Extract the prompt input schema definition for clarity
  const flowDef: FlowDefinition<typeof inputSchema, typeof outputSchema> = {
    name: flowName,
    routePath,
    inputSchema,
    outputSchema,
    template,
    promptOptions: options,
    data: {
      prompt: data.prompt
    }
  };

  // Use the imported createPromptFlow function
  const callableFlow = createPromptFlow(ai, flowDef, registry, file);

  return {
    promptFilePath: routePath,
    flow: callableFlow,
    extracted,
    flowDef,
    nextRoute,
    expressRoute,
  };
}

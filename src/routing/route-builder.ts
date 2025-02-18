import { Genkit, z } from 'genkit';
import { DatapromptFile } from '../core/interfaces.js';
import { PluginRegistry } from '../core/registry.js';
import { SchemaMap } from '../utils/schema-loader.js';
import { DatapromptRoute } from './server.js';
import { createPromptFlow, FlowDefinition, FlowInputSchema } from './flow-builder.js';
// import { resolveZodSchema } from '../utils/schema-loader.js';

export async function createRoute(params: {
  ai: Genkit;
  file: DatapromptFile;
  userSchemas: SchemaMap;
  expressRoute: string;
  registry: PluginRegistry;
  rootDir: string;
}): Promise<DatapromptRoute> {
  const { ai, file, userSchemas, expressRoute, registry } = params;
  const promptMetadata = await ai.registry
    .dotprompt
    .renderMetadata<Record<string, any>>(file.content);
  const { template, output } = ai.registry.dotprompt.parse(file.content);
  if(!promptMetadata.input) {
    promptMetadata.input = {
      schema: z.object({})
    }
  }
  // TODO(davideast): support other input types for flows
  // other than the request: RequestContext
  // ...promptMetadata.input?.schema?.shape,
  promptMetadata.input.schema = FlowInputSchema;
  // replace / with _ for flow names not to break the genkit registry
  const flowName = file.path.replace(/[\/\[\]]/g, '_').replace(/^_/, '');
  const schema: string = output?.schema as any as string;
  if(typeof schema !== 'string') {
    throw new Error(`Only Zod schema names are supported. Provided with ${JSON.stringify(schema, null, 2)}`);
  }
  const outputSchema = userSchemas.get(schema)

  // Extract the prompt input schema definition for clarity
  const flowDef: FlowDefinition = {
    name: flowName,
    routePath: file.path,
    promptMetadata,
    outputSchema,
    data: promptMetadata.ext?.data,
    template,
  };

  // Use the imported createPromptFlow function
  const callableFlow = createPromptFlow(ai, flowDef, registry, file);

  return {
    promptFilePath: file.path,
    flow: callableFlow,
    flowDef,
    nextRoute: file.nextRoute,
    expressRoute,
  };
}

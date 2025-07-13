import { Genkit, z } from 'genkit';
import { PromptConfig as PromptMetadata } from 'genkit';
import { DatapromptFile, RequestContext, RequestContextSchema } from '../core/interfaces.js';
import { PluginManager } from '../core/plugin.manager.js';
import { Prompt } from '../core/prompt.js';

export const FlowInputSchema = z.object({
  request: RequestContextSchema
});

export interface FlowDefinition {
  name: string;
  routePath: string;
  template: string;
  outputSchema?: z.ZodType<any, z.ZodTypeDef, any>;
  promptMetadata: Partial<PromptMetadata>;
  data?: {
    prompt?: {
      sources?: Record<string, Record<string, any>>;
      result?: Record<string, Record<string, any>>;
      trigger?: Record<string, any>;
    }
  };
}

/**
 * Creates a Genkit flow that instantiates and runs a dataprompt Prompt.
 * This function is the primary bridge between the routing layer and the core execution logic.
 */
export function createPromptFlow(options:{
  ai: Genkit,
  flowDef: FlowDefinition,
  pluginManager: PluginManager,
  file: DatapromptFile,
}) {
  const { ai, flowDef, pluginManager, file } = options;

  return ai.defineFlow(
    {
      name: flowDef.name,
      inputSchema: FlowInputSchema,
      outputSchema: flowDef.outputSchema,
    },
    async (input: { request: RequestContext }) => {
      // 1. Instantiate the Prompt class with all necessary dependencies.
      const prompt = new Prompt({
        ai,
        flowDef,
        pluginManager,
        file,
      });

      // 2. Execute the prompt.
      return await prompt.execute(input.request);
    }
  );
}

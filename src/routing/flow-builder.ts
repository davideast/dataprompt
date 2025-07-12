import { Genkit, z } from 'genkit';
import { PromptConfig as PromptMetadata } from 'genkit'; 
import { DatapromptFile, RequestContext, RequestContextSchema } from '../core/interfaces.js';
import { PluginManager } from '../core/plugin.manager.js';
import { RequestLogger, getLogManager } from '../utils/logging.js';
import { fetchPromptSources, executeResultActions } from './action-handler.js';

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

// createPrompt now uses the Partial type correctly
export function createPrompt(options: {
  ai: Genkit,
  flowDef: FlowDefinition,
}) {
  const { ai, flowDef } = options;
  const { data, name, promptMetadata, outputSchema, template } = flowDef;
  const sources = data?.prompt?.sources || {};
  const promptInputSchema = z.object({
    ...Object.fromEntries(
      Object.entries(sources).flatMap(([sourceName, sourceConfig]) => {
        return Object.keys(sourceConfig).map(propertyName => [propertyName, z.any()])
      })
    ),
    request: RequestContextSchema,
  });

  // The definePrompt function accepts a Partial<PromptMetadata>
  return ai.definePrompt({
    name,
    ...promptMetadata,
    input: { schema: promptInputSchema },
    output: outputSchema ? { schema: outputSchema } : undefined,
  }, template);
}

// The rest of the file remains the same...
export function createFlow(options: {
  ai: Genkit,
  flowDef: FlowDefinition,
  pluginManager: PluginManager,
  file: DatapromptFile,
  prompt: ReturnType<typeof createPrompt>,
}) {
  const { ai, flowDef, pluginManager, file, prompt } = options;
  const { data, name, outputSchema } = flowDef;
  const logManager = getLogManager()
  const sources = data?.prompt?.sources || {};
  const resultActions = data?.prompt?.result || {};

  return ai.defineFlow(
    {
      name,
      inputSchema: FlowInputSchema,
      outputSchema,
    },
    async (input: { request: RequestContext }) => {
      const { request } = input;
      let logger: RequestLogger | undefined = undefined;
      if(request.requestId) {
        logger = logManager.get(request.requestId)
      }

      const promptSources = await fetchPromptSources({ 
        sources, 
        request, 
        logger, 
        pluginManager,
        file, 
      });

      const promptInput = { ...promptSources, request };
      
      if (logger) {
        const renderedPrompt = await prompt.render(promptInput);
        await logger.promptCompilationEvent(promptInput, renderedPrompt);
      }

      const result = await prompt(promptInput);

      await executeResultActions({
        resultActions,
        request,
        promptSources,
        result,
        pluginManager,
        logger,
        file,
      });

      return result.output;
    }
  );
}

export function createPromptFlow(options:{
  ai: Genkit,
  flowDef: FlowDefinition,
  pluginManager: PluginManager,
  file: DatapromptFile,
}) {
  const { ai, flowDef, pluginManager, file } = options;
  const prompt = createPrompt({ ai, flowDef });
  return createFlow({
    ai, 
    flowDef, 
    pluginManager,
    file, 
    prompt 
  });
}

import { Genkit, z } from 'genkit';
import { PromptMetadata, defineDotprompt } from '@genkit-ai/dotprompt';
import { DatapromptFile, RequestContext, RequestContextSchema } from '../core/interfaces.js';
import { PluginRegistry } from '../core/registry.js';
import { RequestLogger, getLogManager } from '../utils/logging.js';
import { fetchPromptSources, executeResultActions } from './action-handler.js';

export interface FlowDefinition<
  InputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  OutputSchema extends z.ZodTypeAny = z.ZodTypeAny
> {
  name: string;
  routePath: string;
  inputSchema: InputSchema;
  outputSchema?: OutputSchema;
  template: string;
  promptOptions: Partial<PromptMetadata>;
  data?: {
    prompt?: {
      sources?: Record<string, Record<string, any>>;
      result?: Record<string, Record<string, any>>;
      trigger?: Record<string, any>;
    }
  };
}

export function createPromptFlow(
  ai: Genkit,
  flowDef: FlowDefinition,
  registry: PluginRegistry,
  file: DatapromptFile,
) {
  const { data, name, promptOptions, template, inputSchema, outputSchema } = flowDef;

  const logManager = getLogManager()

  const sources = data?.prompt?.sources || {};
  const resultActions = data?.prompt?.result || {};

  const promptInputSchema = z.object({
    ...Object.fromEntries(
      Object.entries(sources).flatMap(([sourceName, sourceConfig]) => {
        return Object.keys(sourceConfig).map(propertyName => [propertyName, z.any()])
      })
    ),
    request: RequestContextSchema,
  });

  const prompt = defineDotprompt(
    ai.registry,
    {
      name,
      ...promptOptions,
      input: { schema: promptInputSchema },
      output: outputSchema ? { schema: outputSchema } : undefined
    },
    template
  );

  if(file.path.includes('fs')) {
    // console.log({ shape: promptInputSchema.shape })
  }

  return ai.defineFlow(
    {
      name,
      inputSchema,
      outputSchema
    },
    async (input: { request: RequestContext }) => {
      const { request } = input;
      let logger: RequestLogger | undefined = undefined;
      if(request.requestId) {
        logger = logManager.get(request.requestId)
      }

      // 1.  Fetch Data Sources
      const promptSources = await fetchPromptSources({ 
        sources, 
        request, 
        logger, 
        registry,
        file, 
      });

      // 2. Prepare prompt input (including fetched data)
      const promptInput = { ...promptSources, request };

      if(file.path.includes('fs')) {
        // console.log({ promptInput })
      }

      // 3. Render prompt (for logging)
      if (logger) {
        const renderedPrompt = await prompt.render({ input: promptInput });
        await logger.promptCompilationEvent(promptInput, renderedPrompt);
      }

      // 4. Generate Prompt Output
      const result = await prompt.generate({ input: promptInput });

      // 5. Execute Result Actions
      await executeResultActions({
        resultActions,
        request,
        promptSources,
        result,
        registry,
        logger,
        file,
      });

      return result.output;
    }
  );
}

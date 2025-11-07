import { Genkit, z } from 'genkit';
import { DatapromptFile, RequestContext, RequestContextSchema } from './interfaces.js';
import { PluginManager } from './plugin.manager.js';
import { FlowDefinition } from '../routing/flow-builder.js';
import { dateFormat } from '../utils/helpers/date-format.js';
import { processTemplates } from '../utils/helpers/templates.js';
import Handlebars from 'handlebars';

const handlebars = Handlebars.create();
handlebars.registerHelper('dateFormat', dateFormat);

// A pure utility for creating a Genkit prompt object
export function createGenkitPrompt(options: {
  ai: Genkit,
  flowDef: FlowDefinition,
}) {
  const { ai, flowDef } = options;
  const { data, name, promptMetadata, outputSchema, template } = flowDef;
  const sources = data?.prompt?.sources || {};
  // The input schema should have a key for each data source provider.
  const promptInputSchema = z.object({
    ...Object.fromEntries(
      Object.keys(sources).map(sourceName => [sourceName, z.any()])
    ),
    request: RequestContextSchema,
  });

  return ai.definePrompt({
    name,
    ...promptMetadata,
    input: { schema: promptInputSchema },
    output: outputSchema ? { schema: outputSchema } : undefined,
  }, template);
}


/**
 * Encapsulates the entire lifecycle of executing a single .prompt file.
 * It handles data fetching, prompt generation, and result actions.
 */
export class Prompt {
  #ai: Genkit;
  #flowDef: FlowDefinition;
  #pluginManager: PluginManager;
  #file: DatapromptFile;
  #genkitPrompt: ReturnType<typeof createGenkitPrompt>;

  constructor(options: {
    ai: Genkit,
    flowDef: FlowDefinition,
    pluginManager: PluginManager,
    file: DatapromptFile,
  }) {
    this.#ai = options.ai;
    this.#flowDef = options.flowDef;
    this.#pluginManager = options.pluginManager;
    this.#file = options.file;
    this.#genkitPrompt = createGenkitPrompt({ ai: this.#ai, flowDef: this.#flowDef });
  }

  /**
   * Orchestrates the full execution of the prompt.
   * @param request The incoming request context.
   */
  async execute(request: RequestContext): Promise<any> {
    // 1. Fetch all necessary data sources.
    const promptSources = await this.#fetchData(request);

    const promptInput = { ...promptSources, request };

    // 2. Generate the content from the AI model.
    const result = await this.#ai.run('Prompt Generation', async () => {
      return await this.#genkitPrompt(promptInput);
    });

    // 3. Execute any defined result actions.
    await this.#executeActions(request, promptSources, result);

    return result.output;
  }

  /**
   * Fetches data from all sources defined in the prompt's frontmatter.
   * This version is refactored to support the flat API structure.
   */
  async #fetchData(request: RequestContext): Promise<Record<string, any>> {
    const sources = this.#flowDef.data?.prompt?.sources || {};
    const promptSources: Record<string, any> = {};

    for (const [providerName, providerConfig] of Object.entries(sources)) {
      const sourceProvider = this.#pluginManager.getDataSource(providerName);
      const data = await this.#ai.run(`DataSource: ${providerName}`, async () => {
        // The entire config for the provider is processed for templates.
        const processedConfig = processTemplates(handlebars, providerConfig, { request });
        return await sourceProvider.fetchData({
          request,
          config: processedConfig,
          file: this.#file,
        });
      });
      // The result is stored under the provider's name (e.g., 'weather').
      promptSources[providerName] = data;
    }
    return promptSources;
  }

  /**
   * Executes all result actions defined in the prompt's frontmatter.
   * This version is refactored to support the flat API structure.
   */
  async #executeActions(request: RequestContext, promptSources: Record<string, any>, result: { output: any }): Promise<void> {
    const resultActions = this.#flowDef.data?.prompt?.result || {};
    for (const [providerName, providerConfig] of Object.entries(resultActions)) {
      await this.#ai.run(`ResultAction: ${providerName}`, async () => {
        const actionProvider = this.#pluginManager.getAction(providerName);
        const templateData = { ...promptSources, request, output: result.output };
        const processedConfig = processTemplates(
          handlebars,
          providerConfig,
          templateData
        );
        await actionProvider.execute({
          request,
          config: processedConfig,
          promptSources: templateData,
          file: this.#file,
        });
      });
    }
  }
}
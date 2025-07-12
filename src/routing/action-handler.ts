import { Genkit } from 'genkit';
import { DatapromptFile, RequestContext } from '../core/interfaces.js';
import { PluginManager } from '../core/plugin.manager.js';
import { RequestLogger } from '../utils/logging.js';
import Handlebars from 'handlebars';
import { dateFormat } from '../utils/helpers/date-format.js';
import { processTemplates } from '../utils/helpers/templates.js';

const handlebars = Handlebars.create();
handlebars.registerHelper('dateFormat', dateFormat);

export async function fetchPromptSources(params: {
  ai: Genkit;
  sources: Record<string, Record<string, any>>;
  request: RequestContext;
  pluginManager: PluginManager;
  logger?: RequestLogger;
  file: DatapromptFile;
}): Promise<Record<string, any>> {
  const { ai, sources, request, logger, pluginManager, file } = params;
  const promptSources: Record<string, any> = {};

  for (const [sourceName, sourceConfig] of Object.entries(sources)) {
    const source = pluginManager.getDataSource(sourceName);

    for (const [propertyName, config] of Object.entries(sourceConfig)) {
      // Each data source fetch is wrapped in a named trace span.
      const data = await ai.run(`DataSource: ${sourceName}.${propertyName}`, async () => {
        const startTime = Date.now();
        const processedConfig = processTemplates(handlebars, config, { request });

        const fetchedData = await source.fetchData({
          request,
          config: processedConfig,
          file,
        });

        // TODO(davideast): The old logging can be removed or kept for verbose dev output.
        logger?.dataSourceEvent({
          route: request.url,
          source: sourceName,
          variable: propertyName,
          data: fetchedData,
          duration: Date.now() - startTime,
        });

        return fetchedData;
      });

      promptSources[propertyName] = data;
    }
  }

  return promptSources;
}

export async function executeResultActions(params: {
  ai: Genkit;
  resultActions: Record<string, Record<string, any>>;
  request: RequestContext;
  promptSources: Record<string, any>;
  result: { output: any };
  pluginManager: PluginManager;
  logger?: RequestLogger;
  file: DatapromptFile,
}) {
  const { ai, resultActions, request, promptSources, result, logger, pluginManager, file } = params;

  for (const [actionName, actionConfig] of Object.entries(resultActions)) {
    // Each result action is wrapped in a named trace span.
    await ai.run(`ResultAction: ${actionName}`, async () => {
      const action = pluginManager.getAction(actionName);

      const processedConfig = processTemplates(
        handlebars,
        actionConfig,
        { ...promptSources, request, output: result.output }
      );

      await action.execute({
        request,
        config: processedConfig,
        promptSources: { ...promptSources, output: result.output },
        file,
      });

      // TODO(davideast): The old logging can be removed or kept for verbose dev output.
      logger?.actionEvent(actionName, processedConfig, result.output);
    });
  }
}

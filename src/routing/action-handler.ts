import { DatapromptFile, RequestContext } from '../core/interfaces.js';
import { PluginRegistry } from '../core/registry.js';
import { RequestLogger } from '../utils/logging.js';
import Handlebars from 'handlebars';
import { dateFormat } from '../utils/helpers/date-format.js';
import { processTemplates } from '../utils/helpers/templates.js';

const handlebars = Handlebars.create();
handlebars.registerHelper('dateFormat', dateFormat);

export async function fetchPromptSources(params: {
  sources: Record<string, Record<string, any>>;
  request: RequestContext;
  registry: PluginRegistry;
  logger?: RequestLogger;
  file: DatapromptFile;
}): Promise<Record<string, any>> {
  const { sources, request, logger, registry, file } = params;
  const promptSources: Record<string, any> = {};

  for (const [sourceName, sourceConfig] of Object.entries(sources)) {
    const source = registry.getDataSource(sourceName);
    if (!source) {
      throw new Error(`No source provider registered for: ${sourceName}`);
    }

    for (const [propertyName, config] of Object.entries(sourceConfig)) {
      const startTime = Date.now();
      // Process templates with request context
      const processedConfig = processTemplates(
        handlebars,
        config,
        { request }
      );

      const data = await source.fetchData({
        request,
        config: processedConfig,
        file,
      });

      promptSources[propertyName] = data;

      logger?.dataSourceEvent({
        route: request.url,
        source: sourceName,
        variable: propertyName,
        data,
        duration: Date.now() - startTime,
      });
    }
  }

  return promptSources;
}

export async function executeResultActions(params: {
  resultActions: Record<string, Record<string, any>>;
  request: RequestContext;
  promptSources: Record<string, any>;
  result: { output: any };
  registry: PluginRegistry;
  logger?: RequestLogger;
  file: DatapromptFile,
}) {
  const { resultActions, request, promptSources, result, logger, registry, file } = params;

  for (const [actionName, actionConfig] of Object.entries(resultActions)) {
    const action = registry.getAction(actionName);
    if (!action) {
      throw new Error(`No action provider registered for: ${actionName}`);
    }

    // Process templates with context + output
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

    logger?.actionEvent(actionName, processedConfig, result.output);
  }
}

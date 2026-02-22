import { Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { dateFormat } from '../utils/helpers/date-format.js';
import { findUp } from 'find-up';
import { pathToFileURL } from 'node:url';
import { DatapromptConfig } from './config.js';
import { getLogManager } from '../utils/logging.js';

export function createDefaultGenkit(config: DatapromptConfig): Genkit {
  const plugins: any[] = [];
  const googleApiKey = config.secrets?.GOOGLEAI_API_KEY || config.secrets?.GEMINI_API_KEY;

  if (config.genkitPlugins) {
    plugins.push(...config.genkitPlugins);
  }

  for (const plugin of config.plugins) {
    if (plugin.provideGenkitPlugins) {
      plugins.push(...plugin.provideGenkitPlugins());
    }
  }

  // If no plugins are provided, or if we have a Google API key,
  // we try to add Google AI support.
  // We prioritize user provided plugins, but also support Google AI if key is present.
  if (googleApiKey) {
    // We can't easily check if googleAI is already in plugins because they are instances.
    // However, Genkit supports multiple plugins.
    plugins.push(googleAI({ apiKey: googleApiKey }));
  }

  if (plugins.length === 0) {
    throw new Error('FATAL: No Genkit plugins configured and GOOGLEAI_API_KEY/GEMINI_API_KEY not found.');
  }

  const ai = new Genkit({ plugins });
  ai.defineHelper('dateFormat', dateFormat);
  return ai;
}

export async function loadUserGenkitInstance(rootDir: string): Promise<Genkit | undefined> {
  const configPath = await findUp(['dataprompt.config.ts', 'dataprompt.config.js'], { cwd: rootDir });
  if (configPath) {
    try {
      const userModule = await import(pathToFileURL(configPath).toString());
      if (userModule.default?.genkit && userModule.default.genkit instanceof Genkit) {
        return userModule.default.genkit;
      }
    } catch (e) {
      getLogManager().system.warn(`Warning: Could not dynamically import user's genkit instance from ${configPath}.`, e);
    }
  }
  return undefined;
}

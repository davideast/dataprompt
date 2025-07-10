import { Genkit } from 'genkit';
import { DatapromptPlugin } from './interfaces.js';

/**
 * Defines the shape of the configuration object that a user can provide
 * in their dataprompt.config.ts file. All properties are optional.
 * A user can also provide their own pre-configured Genkit instance.
 */
export type DatapromptUserConfig = {
  plugins?: DatapromptPlugin[];
  promptsDir?: string;
  schemaFile?: string;
  secrets?: Record<string, any>;
  rootDir?: string;
  genkit?: Genkit;
};

/**
 * The final, fully resolved, and validated STATIC configuration object
 * that the application will use. All properties are required.
 * It does NOT contain live service instances like Genkit.
 */
export type DatapromptConfig = Required<Omit<DatapromptUserConfig, 'plugins' | 'genkit'>> & {
  plugins: DatapromptPlugin[];
};
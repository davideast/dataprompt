import { PromptConfig as PromptMetadata, z } from 'genkit';
import { DatapromptRoute } from '../routing/server.js';
import { ScheduledTask } from 'node-cron';

// We use 'any' here because FormData can contain File objects and
// defining a precise type for that is super tough. 
export const RequestContextSchema = z.object({
  method: z.string().optional(),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  params: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string())])
  ).optional(),
  query: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string())])
  ).optional(),
  body: z.object({
    json: z.any().optional(),
    form: z.record(z.string(), z.any()).optional(),
    text: z.string().optional()
  }).optional(),
  requestId: z.string().optional()
});

export type RequestContext = z.infer<typeof RequestContextSchema>;

export interface DatapromptPlugin<Schema extends z.AnyZodObject = z.AnyZodObject> {
  name: string;
  createDataSource?(): DataSourceProvider;
  createDataAction?(): DataActionProvider;
  createTrigger?(): TriggerProvider;
  provideSecrets?(): {
    secrets: Partial<z.infer<Schema>>;
    schema?: Schema;
  } | undefined;
}

export type FetchDataParams = {
  request: RequestContext;
  config: any;
  file: DatapromptFile;
}

export interface DataSourceProvider {
  name: string;
  fetchData(params: FetchDataParams): Promise<Record<string, any> | string>;
}

export type ExecuteParams = {
  request: RequestContext;
  config: any;
  promptSources: Record<string, any>;
  file: DatapromptFile;
}

export interface DataActionProvider {
  name: string;
  execute(params: ExecuteParams): Promise<void>;
}

export interface TriggerConfig {
  type: string;
  config: any;
}

export interface Trigger {
  create(
    route: DatapromptRoute,
    config: any,
  ): ScheduledTask;
}

export interface TriggerProvider {
  name: string;
  createTrigger(): Trigger;
}

export interface PromptFile {
  template: string;
  options: Partial<PromptMetadata>;
  data: {
    prompt: {
      sources?: Record<string, Record<string, any>>;
      result?: Record<string, Record<string, any>>;
      trigger?: Record<string, any>;
    };
  };
}

export interface DatapromptFile {
  path: string;
  content: string;
  nextRoute: string;
  absolutePath?: string;
}

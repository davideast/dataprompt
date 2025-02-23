import { DatapromptFile, RequestContext } from '../core/interfaces.js';
import { DatapromptRoute } from '../routing/server.js';
import { ScheduledTask } from 'node-cron';
import { z } from 'genkit';

export interface DatapromptPlugin<
  SecretsSchema extends z.AnyZodObject = z.AnyZodObject,
  Config = SecretsSchema extends z.AnyZodObject 
    ? { secrets?: Partial<z.infer<SecretsSchema>> } & Record<string, any>
    : Record<string, any>
> {
  name: string;
  createDataSource?(): DataSourceProvider;
  createDataAction?(): DataActionProvider;
  createTrigger?(): TriggerProvider;
  provideSecrets?(): {
    secrets: Config;
    schema?: SecretsSchema;
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

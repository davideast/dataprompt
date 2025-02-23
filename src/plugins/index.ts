import { DataActionProvider, DataSourceProvider, DatapromptPlugin } from "./interfaces.js";
import { z } from 'genkit';

export function createPlugin<
  Schema extends z.AnyZodObject = z.AnyZodObject,
  Config extends { secrets?: Partial<z.infer<Schema>> } & Record<string, any> = { secrets?: Partial<z.infer<Schema>> }
>(options: {
  name: string,
  schema: Schema,
  source?: (config?: Config) => DataSourceProvider,
  action?: (config?: Config) => DataActionProvider,
}): (config?: Config) => DatapromptPlugin<Schema> {
  const { name, schema, source, action } = options;
  return function (config?: Config) {
    const plugin: DatapromptPlugin<Schema> = {
      name,
      provideSecrets() {
        return {
          secrets: {
            secrets: config?.secrets
          } as Schema extends z.AnyZodObject 
            ? { secrets?: Partial<z.infer<Schema>> } & Record<string, any>
            : Record<string, any>,
          schema
        }
      }
    };
  
    if(action != null) {
      plugin.createDataAction = () => action(config);
    }
  
    if(source != null) {
      plugin.createDataSource = () => source(config);
    }
  
    return plugin;
  }
}

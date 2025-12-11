// TODO: Fix `package.json` `files` array. It currently references `src/firebase/package.json` which does not exist.
// TODO: Fix `package.json` scripts `packx` and `clean`. They contain hardcoded version `0.0.6` which creates maintenance burden.
// TODO: Verify `package.json` exports match the actual file structure, specifically for plugins.

export { DatapromptRoute } from './routing/server.js';
export { DatapromptConfig } from './core/config.js'
export { dataprompt, createPromptServer } from './core/dataprompt.js'
export { 
  RequestContextSchema, 
  RequestContext, 
  DatapromptPlugin, 
  DataSourceProvider,
  DataActionProvider,
  TriggerConfig,
  TriggerProvider,
} from './core/interfaces.js'
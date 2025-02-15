## Important dataprompt files and code
* src/core/dataprompt.ts
    * Contains the public API the user and dataprompt CLI consumes
* src/core/registry.ts
    * Contains all the plugin registration for data sources, actions, and triggers
* src/routing/server.ts
    * Spins up the express server with routes provided from a dataprompt store instance
* src/routing/flow-builder.ts
    * Extracts data source config from the prompt, gets data source from registry, and fetches data from the plugin.
    * Dynamically creates the dotprompt instance
    * Generates response from LLM call.
    * Creates the input and output schemas given the request
    * Extracts action config from the promopt, gets action provider from registry, executes all actions, which can use data source variables and the output response.
    * This file is incredibly important to test.
* src/routing/index.ts
    * Creates a "RouteCatalog" which is a Map of Next.js and Express routes mapped to a DatapromptRoute type as well as which paths are mapped to a Task. This file is also incredibly important to test.
* src/utils/yaml.ts
    * Extracts YAML config from data.prompt part of the dotprompt YAML. This will eventually be replaced by the dotprompt library itself but it's CRUCIAL there is a test that makes sure that given a prompt YAML or dotprompt file that a specific object extraction will come back.
* src/utils/schema-loader.ts
    * Loads and register's zod schema. 

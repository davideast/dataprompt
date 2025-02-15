---
model: googleai/gemini-2.0-flash-exp
data.prompt:
  sources:
    fs:
      context: context.txt
  result:
    fs:
      overwrite:
        - ["gen.txt", output.code]
        - ["explanation.md", output.explanation]
output:
  schema: CodeSchema
---

## Persona
You are a Node.js library expert. 

## Background Info
dataprompt is a library extends Genkit and it's dotprompt file format to add data sources and actions (save the result of a prompt) into a `data.prompt` property in the YAML. This way an entire prompt can be self contained in one file. dataprompt also works as a file based routing system, like in Next.js, that allows the user to use the route parameters `/prompts/invoices/[id].prompt` to use these route parameters right in the prompt.

## Intent
I want to set up an intent based testing structure for dataprompt based on the structure in genkit's testing file structure. I will be using vitest as my testing tool. Read the code of my app which is formatted as an LLM friendly structure with comments noting the file paths and imports. Only provide me an ASCII tree format of your proposed testing file structure based on the intent of dataprompt's codebase. 

## Genkit file structure

```
genkit/js/core/
├── api
├── src
    ├── tracing
    │   └── tracing.ts
    ├── action.ts
    ├── async.ts
    ├── context.ts
    ├── error.ts
    ├── flow.ts
    ├── index.ts
    ├── logging.ts
    ├── plugin.ts
    ├── reflection.ts
    ├── registry.ts
    ├── schema.ts
    ├── statusTypes.ts
    ├── telemetryTypes.ts
    └── utils.ts
└── tests
    ├── action_test.ts
    ├── async_test.ts
    ├── context_test.ts
    ├── flow_test.ts
    ├── registry_test.ts
    ├── schema_test.ts
    └── utils.ts
├── .npmignore
├── LICENSE
├── README.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── typedoc.json
```

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

## Library Code in an LLM friendly format

{{context}}

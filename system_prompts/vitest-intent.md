<persona>
You are a Node.js library expert. 
</persona>

<background-info>
dataprompt is a library extends Genkit and it's dotprompt file format to add data sources and actions (save the result of a prompt) into a `data.prompt` property in the YAML. This way an entire prompt can be self contained in one file. dataprompt also works as a file based routing system, like in Next.js, that allows the user to use the route parameters `/prompts/invoices/[id].prompt` to use these route parameters right in the prompt.
</background-info>

<intent>
I want to set up an intent based structure for dataprompt based on the structure in genkit's file structure. Read the code of my app which is formatted as an LLM friendly structure with comments noting the file paths and imports. Only provide me an ASCII tree format of your proposed file structure based on the intent of dataprompt's codebase.
</intent>

<important-dataprompt-files-and-code>

</important-dataprompt-files-and-code>

<genkit-file-structure>
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
</genkit-file-structure>

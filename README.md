# dataprompt: prompts with data superpowers

> Status: Alpha

[![npm version](https://badge.fury.io/js/dataprompt.svg)](https://badge.fury.io/js/dataprompt)

## Spin up dataprompt in seconds with Project IDX 

<a href="https://idx.google.com/new?template=https%3A%2F%2Fgithub.com%2Fdavideast%2Fdataprompt%2Ftree%2Fmain%2Ftemplate">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://cdn.idx.dev/btn/try_dark_32.svg">
    <source
      media="(prefers-color-scheme: light)"
      srcset="https://cdn.idx.dev/btn/try_light_32.svg">
    <img
      height="32"
      alt="Try in IDX"
      src="https://cdn.idx.dev/btn/try_purple_32.svg">
  </picture>
</a>

## Single File Prompts
dataprompt is a metaframework for prompt files, combining the power of prompt engineering with file-based routing. It lets you create self-contained "Single File Prompts" — `.prompt` files that define your prompts, data sources, and post-generation actions, all in one place. Think of it as Astro for AI prompts, bringing structure and organization to your AI development workflow.

## Quick Start

### Install and setup

```bash
npm i dataprompt genkit
# or use the dataprompt CLI
npx dataprompt create <project-dir>
```

### Create a `.prompt` file

In your `prompts` directory, create a file like `prompts/hello.prompt`:

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/1.json
  output:
    schema: HNAnalysisSchema
---
Analyse the articles below.

{{json news}}
```

### Run the dataprompt dev server

```bash
npx dataprompt dev
```

This starts a development server that serves your prompts as a JSON API.

## Scheduled Tasks with node-cron

dataprompt supports triggers to automatically execute prompts. The most common are scheduled tasks using `node-cron`. Unlike file-based routes where the URL of your JSON API is determined by the location of the .prompt file, the `schedule` trigger is useful for background processes that need to execute periodically without a request.


```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  trigger:
    schedule:
      cron: '* * * * *' # Runs every minute
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/1.json      
output:
  schema: HNAnalysisSchema
---
Analyze these stories from Hacker News.

{{json news}}
```

# Documentation

## dataprompt CLI and Config

### dataprompt CLI

The dataprompt CLI provides commands to help you develop and manage your dataprompt projects.

*   `dataprompt dev`: Starts the dataprompt development server. It watches your `.prompt` files for changes and automatically reloads the server.
*   `dataprompt create`: Creates a new dataprompt project with a basic directory structure and configuration.

### dataprompt.config.js

The `dataprompt.config.js` file allows you to configure various aspects of dataprompt, such as the prompts directory, schema file, and plugins.

#### Config Options

*   `promptsDir`: (string, default: `'prompts'`) The directory where your `.prompt` files are located. This path is resolved relative to the project root.
*   `schemaFile`: (string, default: `'schema.ts'`) The path to your schema file, which exports Zod schemas for structured output. This path is resolved relative to the project root.
*   `plugins`: (DatapromptPlugin[], default: `[]`) An array of dataprompt plugins to register.
*   `secrets`: (DatapromptSecrets, default: `process.env`) An object containing secret keys, such as API keys. See Secrets.
*   `genkit`: (Genkit, default: `getGenkit()`) A pre-configured Genkit instance to use. If not provided, dataprompt will create a default instance with the Google AI provider.
*   `rootDir`: (string, default: project root) This option sets a custom root directory. This is useful when used in a monorepo setup.

### Secrets

dataprompt automatically looks for the following environment variables:

*   `GOOGLEAI_API_KEY`: API key for the Google AI Gemini model.
*   `GOOGLE_APPLICATION_CREDENTIALS`: Path to a Firebase service account key file.

You can also set these secrets in your `dataprompt.config.{js,ts}` file:

```ts
// dataprompt.config.ts
export default {
  secrets: {
    GOOGLEAI_API_KEY: 'YOUR_API_KEY',
    GOOGLE_APPLICATION_CREDENTIALS: '/path/to/serviceAccountKey.json',
  },
};
```

**Warning:** Never check your secrets into version control. Use environment variables or a secrets management solution instead.

These options are set for the default genkit instance. If you provide your own genkit instance, they are still set, but you will need to configure them yourself.

## Understanding the dotprompt Format

dataprompt extends the [dotprompt](https://github.com/google/dotprompt/) format to add data sources and actions to your prompts. The `data.prompt` property in your YAML frontmatter defines these extensions.

### dotprompt API

The dotprompt format defines several properties:

*   `model`: (string) The name of the Genkit model to use.
*   `config`: (object) Configuration options for the model, such as temperature.
*   `input`: (object) Defines the schema for the prompt's input. *dataprompt does not use this directly*, it will dynamically infer it from the `request` object and any data sources that are defined.
*   `output`: (object) Defines the schema for the prompt's output.

### Zod Schemas and the Schema File

Structured output is declared using [Zod](https://zod.dev/) schemas that are exported from a designated schema file.  This allows you to define the structure and types of the data returned by your prompts, ensuring consistency and type safety.

By default, dataprompt is set up to automatically use `schema.ts` in the `tsconfig.json`'s `"outDir"` option, which is normally `"dist"`.  This means that dataprompt will look for a compiled `schema.js` file in your output directory.  You can customize this behavior using the `schemaFile` option in your `dataprompt.config.js` file.

Example `schema.ts`:

```ts
// schema.ts
import { z } from 'genkit';

export const StorySchema = z.object({
  id: z.number(),
  by: z.string(),
  descendants: z.number().optional(),
  kids: z.array(z.number()).optional(),
  score: z.number(),
  time: z.number(),
  title: z.string(),
  type: z.string(),
  url: z.string().optional(),
  text: z.string().optional()
});

export const HNAnalysisSchema = z.object({
  top5: z.object({
    pageA: z.array(StorySchema),
    pageB: z.array(StorySchema),
  }).describe("Top 5 themes and topics for each page."),
  dominantThemesAndTopics: z.object({
    pageA: z.string(),
    pageB: z.string(),
  }).describe("Dominant themes and topics for each page."),
  keyDifferencesAndSimilarities: z.string().describe("Key differences and similarities between the themes and topics of the pages."),
  interestingInsightsTrendsPatterns: z.string().describe("Interesting insights, trends, patterns, or shifts observed in the comparison."),
  mostProminentThemes: z.object({
    pageA: z.array(z.string()),
    pageB: z.array(z.string()),
  }).describe("Most prominent themes for each page."),
  significantChanges: z.array(z.object({
    change: z.string().describe("Description of a significant change in themes, topics, or content types."),
  })).describe("Significant changes in themes, topics, or content types between the pages.").optional(),
});
```

### Data Sources

The `sources` API allows you to fetch external data and make it available within your prompts.  You declare a source namespace and then define variables within that namespace, assigning them configuration options used to populate them with data.  These variables can then be used in the template below.

Example:

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    fetch:
      # The page variable will contain the JSON data fetched from the API.
      page: https://api.hnpwa.com/v0/news/1.json
output:
  schema: HNAnalysisSchema
---

{{#each page.items as |story|}}
  - {{story.title}}
{{/each}}
```

### Result - Data Actions

The `result` API enables you to perform actions on the output generated by your prompt. You declare an action namespace and then define actions within that namespace, providing configuration details on how they should operate post-generation. The generated `output` variable is provided for you to perform actions on the output generation. Any variables created in `sources` are also available for use in `result`.

Example:

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/1.json
  result:
    firestore:
      push: ['/news_summaries', output]
output:
  schema: HNAnalysisSchema
---

Summarize the following news articles:

{{#each news.articles as |article|}}
  - {{article.title}}
  - {{article.content}}
{{/each}}
```

### The Request Object

Every prompt has access to a `request` object, which can be used as a template variable.  This object contains information about the incoming request, such as the method, URL, headers, parameters, and query string. You can access any properties populated on the `RequestContext` type, which is a serialized version of a Request object. The `RequestContextSchema` is:

```ts
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
```

Example:

```hbs
---
model: googleai/gemini-2.0-flash
output:
  schema: ExampleSchema
---

The URL is: {{request.url}}
The method is: {{request.method}}
The parameter 'id' is: {{request.params.id}}
```

### Date Format Helper

The `dateFormat` helper is a Handlebars helper that allows you to format dates within your prompts.  It can be used in either the frontmatter or the template.

Syntax:

```hbs
{{dateFormat value format="yyyy-MM-dd HH:mm:ss"}}
```

*   `value`:  A string representing a date command or a relative date.  Supported commands are `today` and `yesterday`.  Relative dates can be specified using a number followed by a unit of time (e.g., `-1 day`, `+2 hours`).
*   `format`:  An optional format string using [date-fns](https://date-fns.org/) syntax.  Defaults to `yyyy-MM-dd`.

Examples:

```hbs
Today's date: {{dateFormat "today" format="yyyy-MM-dd"}}
Yesterday's date: {{dateFormat "yesterday" format="MM/dd/yy"}}
Date one day ago: {{dateFormat "-1 day" format="yyyy-MM-dd"}}
Date in 2 hours: {{dateFormat "+2 hours" format="yyyy-MM-dd HH:mm:ss"}}
```

### Triggers

Triggers allow you to automate the execution of your prompts based on specific events or schedules.  Currently, the only supported trigger type is `ScheduledTask` from `node-cron`, but different trigger types are on the roadmap.

Example:

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  trigger:
    schedule:
      cron: '0 0 * * *' # Run every day at midnight
output:
  schema: ExampleSchema
---
This prompt will be executed every day at midnight. Tell me something new.
```

**Important Considerations:**

*   The `schedule` API does not work with file-based routing.  Scheduled tasks are defined and executed independently of incoming HTTP requests.
*   There can only be one trigger defined per prompt.
*   ScheduledTasks are named after the route, which can be retrieved for modification.

**TaskManager API**

The `TaskManager` API provides methods to manage scheduled tasks:

*   `single(nextRoute: string): ScheduledTask`:  Retrieves a specific scheduled task by its route.
*   `all(): Map<string, ScheduledTask>`:  Returns a map of all scheduled tasks.
*   `cleanup(): void`: Stops all tasks and clears the task list.
*   `startAll(): void`: Starts all scheduled tasks.
*   `stopAll(): void`: Stops all scheduled tasks.

### Using non Gemini Models

dataprompt is built to work with Google AI (Gemini) models out-of-the-box. However, you can configure a custom Genkit instance with other models and providers as plugins and provide it to a DatapromptConfig.

[See Genkit Plugins](https://github.com/TheFireCo/genkit-plugins)

Example:

```js
// dataprompt.config.js
import { genkit } from 'genkit';
import { otherModelPlugin } from '<other-model>';

/** @type {import('dataprompt').DatapromptConfig} */
export default {
  genkit: genkit({
    plugins: [
      otherModelPlugin({ /* ... */ })
    ]
  })
};
```

Out-of-the-box model support for other providers is on the roadmap.

### JavaScript API - Using dataprompt in your own app

You can use dataprompt's JavaScript API to integrate it into your existing applications without needing to run dataprompt as a server.

1.  **Create a DatapromptStore instance:**

    ```js
    import { dataprompt } from 'dataprompt';

    const store = await dataprompt({
      promptsDir: 'prompts', // Optional: Customize the prompts directory
      schemaFile: 'schema.ts'  // Optional: Customize the schema file path
    });
    ```

    **Options:**

    *   `promptsDir`:  (string, optional) The directory where your `.prompt` files are located. Defaults to `'prompts'`.
    *   `schemaFile`:  (string, optional) The path to your Zod schema file. Defaults to `'schema.ts'`.
    *   `genkit`: (Genkit, optional) A pre-configured Genkit instance. If not provided, dataprompt will create one with the Google AI plugin.
    *   `plugins`: (DatapromptPlugin[], optional) An array of custom plugins to register.
    *   `secrets`: (DatapromptSecrets, optional) An object containing API keys and other secrets.
    *   `rootDir`: (string, optional) The root directory of your project.

2.  **Use the `generate` method:**

    ```js
    // Uses a request or URL to match the path but dataprompt is not running a server.
    // A URL of '/hello/david?=msg="hi" matches /prompts/hello/[user].prompt
    // and maps the query string to the request object provided to teh template
    const result = await store.generate({
      url: '/hello/david?message="hi"'
    });
    console.log(result);
    ```

    The `generate` method takes a URL, a Request object, or a RequestContext object as input and returns the generated output. The return type is specified with a generic.

    **Overloads:**

    *   `generate<Output = any>(url: string): Promise<Output>`
    *   `generate<Output = any>(request: Request): Promise<Output>`
    *   `generate<Output = any>(requestContext: RequestContext): Promise<Output>`

### Creating Custom Plugins

You can extend dataprompt's functionality by creating custom plugins.  A plugin can provide data sources, data actions, and triggers.

To create a plugin, implement the `DatapromptPlugin` interface:

```ts
export interface DatapromptPlugin {
  name: string;
  createDataSource?(): DataSourceProvider;
  createDataAction?(): DataActionProvider;
  createTrigger?(): TriggerProvider;
}
```

*   `name`: A unique name for your plugin.
*   `createDataSource?(): DataSourceProvider`: An optional method that returns a `DataSourceProvider`.
*   `createDataAction?(): DataActionProvider`: An optional method that returns a `DataActionProvider`.
*   `createTrigger?(): TriggerProvider`: An optional method that returns a `TriggerProvider`.

#### DataSourceProvider

Provides data to your prompts.

```ts
export interface DataSourceProvider {
  name: string;
  fetchData(params: FetchDataParams): Promise<Record<string, any> | string>;
}

export type FetchDataParams = {
  request: RequestContext;
  config: any;
  file: DatapromptFile;
}
```

*   `name`: A unique name for your data source.
*   `fetchData(params: FetchDataParams): Promise<Record<string, any> | string>`:  A method that fetches data and returns it as a `Record<string, any>` or a string.

Example:

```ts
import { DatapromptPlugin, DataSourceProvider, FetchDataParams } from 'dataprompt';

function myDataSource(): DatapromptPlugin {
  return {
    name: 'my-data-source',
    createDataSource(): DataSourceProvider {
      return {
        name: 'my-data-source',
        async fetchData(params: FetchDataParams) {
          // Fetch data here
          return { message: 'Hello from my data source!' };
        }
      };
    }
  };
}
```

#### DataActionProvider

Performs actions after a prompt is executed.

```ts
export interface DataActionProvider {
  name: string;
  execute(params: ExecuteParams): Promise<void>;
}

export type ExecuteParams = {
  request: RequestContext;
  config: any;
  promptSources: Record<string, any>;
  file: DatapromptFile;
}
```

*   `name`: A unique name for your data action.
*   `execute(params: ExecuteParams): Promise<void>`:  A method that executes the action.

Example:

```ts
import { DatapromptPlugin, DataActionProvider, ExecuteParams } from 'dataprompt';

function myDataAction(): DatapromptPlugin {
  return {
    name: 'my-data-action',
    createDataAction(): DataActionProvider {
      return {
        name: 'my-data-action',
        async execute(params: ExecuteParams) {
          // Perform action here
          console.log('Executing my data action with output: ', params.promptSources.output);
        }
      };
    }
  };
}
```

#### Custom Triggers

dataprompt currently only supports Scheduled Tasks with node-cron but more customizable triggers are on the roadmap.

### Running and Deploying the dataprompt Server

You can run the dataprompt server using the `createPromptServer()` function.

```js
import { createPromptServer } from 'dataprompt';

async function main() {
  const { server } = await createPromptServer();
  server.listen(3000, () => {
    console.log('Server listening on port 3000');
  });
}

main();
```

**Options:**

*   `config`: (DatapromptConfig, optional) A configuration object for dataprompt.
*    `startTasks`: (boolean, optional) A boolean for start all cron jobs on start. Defaults to `true`.

The `createPromptServer()` function returns an object with the following properties:

*   `server`: An Express app instance.
*   `store`: A DatapromptStore instance.

Since the server is an Express app, you can deploy it to any Node.js hosting provider.

### Built-in Plugins

dataprompt comes with several built-in plugins:

#### firestorePlugin
**Status:** Experimental, not meant for production.

Provides access to Google Cloud Firestore.

*   This plugin is provided by default, but you can override it if you need to provide your own configuration.
*   To configure your own `firestorePlugin`, register it to the plugins in the `dataprompt.config.ts` like below. This will be take precidence over the default firestore plugin registration.

```ts
// dataprompt.config.js
import { firestorePlugin } from 'dataprompt/plugins/firebase';

/** @type {import('dataprompt').DatapromptConfig} */
export default {
  plugins: [
    firestorePlugin({ /* ... */ })
  ]
};
```

**Data Source API:**

*   Reads documents and collections from Firestore.

Example:

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    firestore:
      shark: sharks/{{request.params.shark}}
      facts: "/facts"
output:
  schema: SharkFact
---
Tell me a fact about the {{shark.type}} shark.
Today's date is {{dateFormat "today" format="yyyy-MM-dd"}}

Don't tell me these facts again:
{{#each facts as |doc|}}
  - {{doc.fact}}
{{/each}}
```

**Result Actions API:**

*   Pushes data to Firestore with a generated ID

Example:

```hbs
---
# File: /prompts/hn/[page].prompt
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    fetch:
      newsPage: https://api.hnpwa.com/v0/news/{{request.params.page}}.json
  result:
    firestore:
      push: 
      - ['/analysis', output]
      - ['/archive/{{request.params.id}}/stories', newsPage]
output:
  schema: HNAnalysisSchema
---
Analyze these stories

{{json newsPage}}
```

#### fetchPlugin
**Status:** Experimental, not meant for production.

Provides a simple `fetch` data source.

*   This plugin is provided by default, but you can override it if you need to provide your own configuration.
*   To configure your own `fetchPlugin`, register it to the plugins in the `dataprompt.config.ts` like below. This will be take precidence over the default fetch plugin registration.

```ts
// dataprompt.config.js
import { fetchPlugin } from 'dataprompt/plugins/fetch';

/** @type {import('dataprompt').DatapromptConfig} */
export default {
  plugins: [
    fetchPlugin({ /* ... */ })
  ]
};
```

**Data Source API:**

*   The sources API supports a string or an object with additional properties.
*   Limited to GET requests only; support for all HTTP verbs and an action API for webhook-like functionality is on the roadmap.

Example (string):

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    fetch:
      page: https://api.hnpwa.com/v0/news/1.json
output:
  schema: HNAnalysisSchema
---

{{#each page.items as |story|}}
  - {{story.title}}
{{/each}}
```

Example (object):

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    fetch:
      pageContent: 
        url: https://<api>.<example>.com/page.txt
        format: text # Can be text or json, defaults to json if not provided
output:
  schema: ExampleSchema
---

{{pageContent.content}}
```

#### schedulerPlugin
**Status:** Experimental, not meant for production.

Provides scheduled task triggers using `node-cron`.

*   This plugin is provided by default, but you can override it if you need to provide your own configuration.
*   To configure your own `schedulerPlugin`, register it to the plugins in the `dataprompt.config.ts` like below. This will be take precidence over the default scheduler plugin registration.

```ts
// dataprompt.config.js
import { schedulerPlugin } from 'dataprompt/plugins/scheduler';

/** @type {import('dataprompt').DatapromptConfig} */
export default {
  plugins: [
    schedulerPlugin()
  ]
};
```

**Trigger API:**

*   The cron expression needs to be valid to create a schedule trigger. For more about writing valid cron expressions visit [crontab.guru](https://crontab.guru/)

Example:

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  trigger:
    schedule:
      cron: '0 0 * * *' # Run every day at midnight
output:
  schema: ExampleSchema
---

This prompt will be executed every day at midnight. Give me an example of any random data.
```

#### fsPlugin
**Status:** Experimental, not meant for production.

This plugin allows you to read and write files from within your prompts.

*   This plugin is **not** provided by default and must be manually added to your `dataprompt.config.js`.


Then, register the plugin in your `dataprompt.config.js`:

```js
// dataprompt.config.js
import { fsPlugin } from 'dataprompt/plugins/fs';

/** @type {import('dataprompt').DatapromptConfig} */
export default {
  plugins: [
    fsPlugin()
  ]
};
```

**Options:**

*   `sandboxDir`: (string, required) The directory where the plugin will read and write files.  This is a **critical security setting** that limits the plugin's access to the file system. Defaults to `/tmp/dataprompt-sandbox`. **Always set this to a dedicated directory to prevent access to sensitive files.**

**IMPORTANT SECURITY NOTE:**  The `sandboxDir` option is crucial for security.  If you do not set this option, the plugin will have access to the entire file system, which could allow attackers to read or write sensitive files.  **Always set `sandboxDir` to a dedicated directory for dataprompt to prevent unauthorized file system access.**

**Data Source API:**

*   Reads files from the `sandboxDir`.

Example:

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  sources:
    fs:
      myFile: my-data.json
output:
  schema: ExampleSchema
---
Look at this and tell me something:
{{json myFile}}
```

**Result Actions API:**

*   Writes files to the `sandboxDir`.

Example:

```hbs
---
model: googleai/gemini-2.0-flash
data.prompt:
  result:
    fs:
      create:
        path: output.txt
        source: output
      overwite:
        - [path/to/file.txt, output]
output:
  schema: ExampleSchema
---

Write 'Hello, world!'
```

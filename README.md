# dataprompt: prompts with data superpowers
> Status: alpha

## It's kinda like htmx... but for prompts

[htmx](https://github.com/bigskysoftware/htmx) provides an incredible amount of functionality through hypertext attributes. What if we can do the same prompts?

dataprompt allows you to declare data sources and actions right from a `.prompt` files, that are wired out to a file based routing system based on Next.js' syntax.

## Key Features
*  **Single File Prompts:** Contain everything a prompt needs from model choice, structured output, data sources, and post-generation actions, right in a single prompt file.
*  **dotprompt format:**: Extends the [dotprompt](https://github.com/google/dotprompt/) prompt.
*  **File based routing:** All prompts are served over an api server based on file based routing conventions: `prompts/items/[id].prompt`.
*  **Scheduled Tasks:**: Set prompt files to run on a schedule with node-cron expressions.
*  **JavaScript API:** Use dataprompt right inside your app by getting dataprompt files as Genkit flows.
*  **Structured Output:** Use Zod schema's to set structured output.
*  **Plugin System:** Create your own data sources, actions, and triggers.
*  **Powered by Genkit:** Every prompt file exports out to a [Genkit](https://firebase.google.com/docs/genkit) flow.

## Installation

```bash
npm install dataprompt genkit
```

## Getting Started

```bash
npx dataprompt create <project-name>
cd <project-name> && npm i
# Set env vars to talk to Gemini and Firebase
# GOOGLEAI_API_KEY=key 
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npx dataprompt dev # dev server
```


### Create a Single File Prompt
Create dotprompt, `.prompt`, files that combine Handlebars templating with data sources.

```hbs
---
# File: prompts/sharks/[shark].prompt
model: googleai/gemini-2.0-flash-exp
data.prompt:
  sources:
    firestore: # Load from Firestore
      shark: sharks/{{request.params.shark}} # Document path using request params
      facts: "/facts" # Collection path
  result:
    firestore: # Store the output to Firestore
      push:
        - ["/facts", output] # Add a new document to the collection
        - ["/known-sharks", shark] # Store the shark data
output:
  schema: SharkFact # Structured output, located in schema.ts
---
Tell me a fact about the {{shark.type}} shark.
Today's date is {{dateFormat "today" format="yyyy-MM-dd"}}
Don't tell me these facts again:
{{#each facts as |doc|}}
  - {{doc.fact}}
{{/each}}
```

```ts
// schema.ts
export const SharkFact = z.object({
  fact: z.string(),
  dateString: z.string().describe('ISO Date String')
})
```

### Configuration
Optionally create a `dataprompt.config.js` file to customize `dataprompt`:
```javascript
// dataprompt.config.js
export default {
  promptsDir: 'prompts',
  schemaFile: 'myschema.ts',
  plugins: [

  ]
}

```
### JavaScript API
```typescript
import { dataprompt } from 'dataprompt';
const store = dataprompt({
  promptsDir: 'prompts',
  // schemaFile: 'schema.ts', // Optional: Path to your schema file
  // plugins: [...] // Optional: Array of plugins
});

// Generate a prompt based on a URL or request object
const sharkFact = await store.generate({
  url: '/sharks/great-white' // Or: request: Request object
});

console.log({ sharkFact });
```

### Development Server
Spins up a development server that serves your prompts and handles data fetching.

```bash
dataprompt dev
```


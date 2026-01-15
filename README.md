# dataprompt: Prompts with data superpowers

**dataprompt** is a metaframework for creating data-connected AI prompts. It uses a file-based routing system where the path to a `.prompt` file determines its API endpoint. This allows you to create self-contained "Single File Prompts" that define your prompt, data sources, and post-generation actions all in one place.

For in-depth documentation, see [DOCS.md](./DOCS.md).

## Quick Start

### 1. Install dataprompt

```bash
npm i dataprompt genkit
```

### 2. Create a `.prompt` file

Create a file named `prompts/hello.prompt`:

```hbs
---
model: googleai/gemini-1.5-flash
---
Hello, world!
```

### 3. Run the dev server

```bash
npx dataprompt dev
```

This starts a development server. You can now access your prompt at `http://localhost:3000/hello`.

## Example with Data

`dataprompt` shines when you connect your prompts to data sources. Here's an example that fetches Hacker News stories:

**`prompts/hn/[page].prompt`**
```hbs
---
model: googleai/gemini-1.5-flash
data.prompt:
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/{{request.params.page}}.json
---
Analyze the titles of these Hacker News stories:

{{#each news}}
- {{this.title}}
{{/each}}
```

Now you can access this prompt with a dynamic parameter, for example: `http://localhost:3000/hn/1`.

## Learn More

For more detailed information on configuration, plugins, data sources, and advanced features, please read the full documentation in [DOCS.md](./DOCS.md).

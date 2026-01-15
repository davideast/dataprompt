# dataprompt: Prompts with data superpowers

dataprompt is a metaframework for prompt files, combining the power of prompt engineering with file-based routing. It lets you create self-contained `.prompt` files that define your prompts, data sources, and post-generation actions, all in one place.

## Quick Start

### Install and setup

```bash
npm i dataprompt genkit
```

### Create a `.prompt` file

In your `prompts` directory, create a file like `prompts/hello.prompt`:

```hbs
---
model: googleai/gemini-1.5-flash
---
Hello world!
```

### Run the dataprompt dev server

```bash
npx dataprompt dev
```

This starts a development server that serves your prompts as a JSON API. You can now access your prompt at `http://localhost:3000/hello`.

---

For more detailed documentation, see [DOCS.md](DOCS.md).

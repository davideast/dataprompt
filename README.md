# DataPrompt

> Status: Alpha

DataPrompt is a powerful metaframework that enhances your prompts with data superpowers, allowing you to create dynamic, data-driven AI applications with ease. It combines the simplicity of file-based routing with the flexibility of data sources and actions, making it the ideal tool for building sophisticated AI workflows.

## Quick Start

### Spin up dataprompt in seconds with Project IDX
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

### Installation
Get started with DataPrompt by installing it via npm:

```bash
npm i dataprompt genkit
```

Alternatively, you can use the DataPrompt CLI to create a new project:

```bash
npx dataprompt create <project-dir>
```

### Create a `.prompt` File
Create a new file with the `.prompt` extension in your designated prompts directory. This file will define your prompt, its data sources, and any post-generation actions.

**Example:** `prompts/[page].prompt`
```hbs
---
model: googleai/gemini-2.5-flash
data.prompt:
  sources:
    fetch:
      news: https://api.hnpwa.com/v0/news/{{request.params.page}}.json
output:
  schema: HNAnalysisSchema
---
Analyse the articles below.

{{json news}}
```
This example defines a prompt that fetches news articles from an API and uses them to generate an analysis based on the `HNAnalysisSchema`.

### Run the Dev Server
Launch the DataPrompt development server to serve your prompts as a JSON API:

```bash
npx dataprompt dev
```

This command starts a local server that monitors your `.prompt` files for changes and automatically reloads, streamlining the development process.

## Key Features

- **File-Based Routing**: Automatically transforms your `.prompt` files into API endpoints, simplifying the creation of web-based AI services.
- **Data-Enhanced Prompts**: Seamlessly integrate data from various sources, such as APIs and databases, directly into your prompts.
- **Scheduled Triggers**: Automate prompt execution at regular intervals using cron jobs, perfect for recurring tasks and data processing.
- **Extensible with Plugins**: Customize and expand DataPrompt's capabilities by creating your own plugins for data sources, actions, and triggers.
- **Structured Output**: Ensure type safety and consistency by defining the output structure of your prompts with Zod schemas.
- **Developer-Focused CLI**: Streamline your workflow with a powerful command-line interface for creating, managing, and running your DataPrompt projects.

## Documentation

For more detailed information and advanced usage, please refer to our full [documentation](DOCS.md).

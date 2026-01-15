# Dataprompt

Dataprompt is a metaframework for creating data-driven AI prompts. It allows you to combine prompt engineering with file-based routing, creating self-contained `.prompt` files that define your prompts, data sources, and post-generation actions.

## Key Features

*   **Single File Prompts:** Define your prompts, data sources, and actions in a single `.prompt` file.
*   **File-Based Routing:** The path to your `.prompt` file determines its API endpoint.
*   **Data Integration:** Fetch data from external sources and use it in your prompts.
*   **Scheduled Tasks:** Automatically execute prompts on a schedule.
*   **Extensible:** Create custom plugins to add new data sources, actions, and triggers.

## Getting Started

### Installation

```bash
npm install dataprompt genkit
```

### Create a `.prompt` file

Create a file named `hello.prompt` in your `prompts` directory:

```hbs
---
model: googleai/gemini-1.5-flash
---
Hello, world!
```

### Run the dev server

```bash
npx dataprompt dev
```

This will start a development server at `http://localhost:3000`. You can now access your prompt at `http://localhost:3000/hello`.

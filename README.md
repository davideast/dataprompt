# Dataprompt

Dataprompt is a powerful tool that enhances prompts with data superpowers, allowing you to create dynamic and data-driven AI applications. It combines prompt engineering with file-based routing to build complex AI workflows.

## Key Features

- **Single File Prompts**: Create self-contained `.prompt` files that define data sources, prompts, and post-generation actions in one place.
- **File-Based Routing**: Serve prompts as a JSON API, where the URL is determined by the file path.
- **Scheduled Triggers**: Automate prompt execution with scheduled tasks.
- **Extensible Plugins**: Integrate with external services and data sources through custom plugins.

## Quick Start

1. **Installation**:
   ```bash
   npm install dataprompt genkit
   ```

2. **Create a `.prompt` file**:
   In your `prompts` directory, create `[page].prompt`:
   ```hbs
   ---
   model: googleai/gemini-1.5-flash
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

3. **Run the dev server**:
   ```bash
   npx dataprompt dev
   ```

## Getting Started

To create a new Dataprompt project, run:
```bash
npx dataprompt create <project-dir>
```

This command sets up a new project with a basic directory structure and all the necessary configurations.

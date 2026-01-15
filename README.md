# dataprompt

Dataprompt is a tool that lets you create powerful prompts for AI models. It combines your prompts with data from external sources, like APIs or databases, to generate dynamic and context-aware responses.

## Key Features

- **Single File Prompts:** Define your prompts, data sources, and actions in a single `.prompt` file.
- **File-Based Routing:**  The file path of your `.prompt` file determines the API endpoint for your prompt.
- **Data Integration:**  Fetch data from APIs, databases, or local files and use it in your prompts.
- **Scheduled Triggers:**  Run prompts on a schedule using cron jobs.
- **Extensible:**  Create custom plugins to add new data sources and actions.

## Quick Start

1. **Installation:**

   ```bash
   npm install dataprompt
   ```

2. **Create a `.prompt` file:**

   Create a file named `prompts/hn/[page].prompt`:

   ```hbs
   ---
   model: googleai/gemini-1.5-flash
   data.prompt:
     sources:
       fetch:
         news: https://api.hnpwa.com/v0/news/{{request.params.page}}.json
   ---

   Summarize the top 5 stories from Hacker News:

   {{#each news}}
   - {{this.title}}
   {{/each}}
   ```

3. **Run the development server:**

   ```bash
   npx dataprompt dev
   ```

   This will start a development server on port 3000. You can now access your prompt at `http://localhost:3000/hn/1`.

# Dataprompt

Dataprompt is a powerful metaframework for creating data-driven AI prompts. It allows you to seamlessly connect your prompts to various data sources and trigger actions based on the generated results, all within a simple and organized file-based routing system.

## Getting Started

To get started with Dataprompt, you can use the CLI to create a new project:

```bash
npx dataprompt create my-dataprompt-app
```

This will set up a new project with a basic directory structure and all the necessary configuration to get you up and running.

## Key Features

- **File-Based Routing**: Each `.prompt` file is automatically mapped to a unique API endpoint, making it easy to organize and manage your prompts.
- **Data Sources**: Connect your prompts to external data sources, such as APIs or databases, to create dynamic and context-aware AI applications.
- **Data Actions**: Trigger actions based on the generated output of your prompts, such as storing results in a database or calling a webhook.
- **Scheduled Triggers**: Automate the execution of your prompts with scheduled triggers, perfect for background tasks and periodic data processing.
- **Plugin Architecture**: Extend the functionality of Dataprompt with custom plugins for data sources, actions, and triggers.
- **Zod Schema Support**: Define the structure of your prompt outputs using Zod schemas for improved type safety and data validation.

## Documentation

For more detailed information and advanced usage, please refer to our full documentation.

[View the full documentation](./DOCS.md)

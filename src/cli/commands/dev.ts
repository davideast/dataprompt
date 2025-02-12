import * as p from '@clack/prompts';
import color from 'picocolors';
import { join } from 'path';
import { DatapromptRoute } from '../../index.js';
import { Server } from 'http';
import { events } from '../../core/events.js';
import { createPromptServer } from '../../core/dataprompt.js';
import { ScheduledTask } from 'node-cron';

const promptMessages = [
  'Training prompt engineers',
  'Aligning AI values',
  'Calibrating temperature settings',
  'Computing attention scores',
  'Preparing context window'
];

function formatError(error: Error): string {
  return `${color.red('Error:')} ${error.message}\n${color.dim(error.stack || '')}`;
}

function formatSchemaError(error: Error): string {
  const message = error.message;

  // Check if this is a schema validation error
  if (message.includes('Schema validation failed')) {
    // Extract the key parts using regex
    const parseErrors = message.match(/Parse Errors:\n\n(.*?)\n\nProvided/s)?.[1] || '';
    const providedData = message.match(/Provided data:\n\n(.*?)\n\nRequired/s)?.[1] || '';
    const schema = message.match(/Required JSON schema:\n\n(.*?)(?:\n\s*$|\s*$)/s)?.[1] || '';

    return [
      color.red('Schema Validation Error:'),
      '',
      color.yellow('Expected Schema:'),
      color.dim(JSON.stringify(JSON.parse(schema), null, 2)),
      '',
      color.yellow('Provided Data:'),
      color.dim(providedData),
      '',
      color.yellow('Validation Errors:'),
      color.red(parseErrors.split('\n').map(line => `  ${line}`).join('\n'))
    ].join('\n');
  }

  // For non-schema errors, return the original format
  return formatError(error);
}

function formatRoutes(routes: Map<string, DatapromptRoute>, port: number) {
  return Array.from(routes.keys())
    .map(route => {
      const methods = color.green('GET/POST');
      // TODO(davideast): Don't hardcode localhost, think of hosted URLs
      const formattedUrl = color.dim('http://localhost:') + port + `/${color.cyan(route)}`;
      return `  ${methods} ${formattedUrl}`;
    })
    .join('\n');
}

function formatTasks(tasks: Map<string, ScheduledTask>) {
  return Array.from(tasks.entries())
    .map(([path]) => {
      const formattedTask = color.cyan(path);
      return `  ${formattedTask}`;
    })
    .join('\n');
}

export async function devCommand() {
  const args = process.argv.slice(2);
  const portFlag = args.indexOf('--port');
  const port = portFlag !== -1 ? parseInt(args[portFlag + 1]) : 3033;

  // Set development mode
  process.env.NODE_ENV = 'development';

  console.clear();
  p.intro(`${color.bgCyan(color.black(' dataprompt dev '))}`);

  const s = p.spinner();
  let httpServer: Server | null = null; // Use http.Server

  // --- REGISTER LISTENERS *FIRST* ---
  const activeRequests = new Set<string>();

  events.on('request:start', (context) => {
    activeRequests.add(context.requestId);
    console.log(
      `\n${color.dim(new Date().toLocaleTimeString())} ${color.green('→')} ${color.bold(context.routePath)} ${color.dim(context.resolvedPath)}`
    );
  });

  events.on('datasource:event', (context) => {
    const type = context.type;
    const route = context.route || '';
    console.log(
      `${color.dim('├')} ${type}: ${color.yellow(route)}`,
      `\n${color.dim('├')} Data: ${color.yellow(context.source)}:${context.variable}`,
      `\n${color.dim('│')} Took: ${color.yellow(context.duration + 'ms')}`,
      `\n${color.dim('│')} Data: ${color.dim(JSON.stringify(context.data, null, 2))}`
    );
  });

  events.on('request:error', (context) => {
    if (!activeRequests.has(context.requestId)) return;
    console.log(
      `${color.dim('├')} ${color.red('✖')} ${formatSchemaError(context.error)}`,
    );
    activeRequests.delete(context.requestId);
  });

  events.on('request:complete', (context) => {
    if (!activeRequests.has(context.requestId)) return;
    console.log(
      `${color.dim('└')} ${color.green('✓')} Completed in ${color.yellow(context.duration + 'ms')}`
    );
    activeRequests.delete(context.requestId);
  });

  events.on('prompt:compile', (context) => {
    if (!activeRequests.has(context.requestId || context.id)) return;

    const { prompt } = context;
    console.log(
      `${color.dim('├')} ${color.cyan('Prompt Compilation')}`,
      `\n${color.dim('│')} ${color.white(prompt[0].text)}`,
      `\n${color.dim('│')}`,
    );
  });

  events.on('action:event', (context) => {
    if (!activeRequests.has(context.requestId || context.id)) return;

    console.log(
      `${color.dim('├')} ${color.magenta('Action:')} ${color.bold(context.actionName)}`,
      '\n'
    );

    // Display action configuration
    console.log(
      `${color.dim('│')} ${color.yellow('Config:')}`
    );

    // Handle any config object structure
    if (typeof context.config === 'object' && context.config !== null) {
      // For each top-level config key, format its contents
      Object.entries(context.config).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          console.log(
            `${color.dim('│')} ${color.dim(key + ':')}`,
            value.map(item => {
              // If array contains tuples/paths, format as paths
              if (Array.isArray(item)) {
                return `\n${color.dim('│')}   ${color.dim('→')} ${item[0]}`;
              }
              // If array contains strings, assume they're paths
              if (typeof item === 'string') {
                return `\n${color.dim('│')}   ${color.dim('→')} ${item}`;
              }
              // Otherwise format as JSON
              return `\n${color.dim('│')}   ${color.dim(JSON.stringify(item))}`;
            }).join('')
          );
        } else {
          // For non-array values, show the JSON representation
          console.log(
            `${color.dim('│')} ${color.dim(key + ':')} ${color.dim(JSON.stringify(value))}`
          );
        }
      });
    } else {
      // Handle primitive config values
      console.log(
        `${color.dim('│')} ${color.dim(JSON.stringify(context.config))}`
      );
    }

    // Display action result data
    console.log(
      `\n${color.dim('│')} ${color.yellow('Result:')}`,
      `\n${color.dim('│')} ${color.dim(JSON.stringify(context.result, null, 2).replace(/\n/g, '\n' + color.dim('│') + ' '))}`,
      '\n'
    );
  });

  events.on('task:created', (context) => {
    console.log(
      `\n${color.dim('├' + new Date().toLocaleTimeString())} ${color.cyan('→')} Task created: ${color.cyan(context.route)}`,
      `\n${color.dim('├')} Provider: ${color.yellow(context.provider)}`,
      `\n${color.dim('├')} Config: ${color.dim(context.config)}`,
    );
  });

  events.on('task:start', (context) => {
    console.log(
      `\n${color.dim(new Date().toLocaleTimeString())} ${color.green('→')} Task started: ${color.green(context.route)}`,
    );
    activeRequests.delete(context.id);
  });

  events.on('task:stop', (context) => {
    console.log(
      `${color.dim(new Date().toLocaleTimeString())} ${color.red('✖')} Task stopped: ${color.green(context.route)}`
    );
    activeRequests.delete(context.id);
  });

  events.on('task:error', (context) => {
    console.log(
      `${color.dim('└')} ${color.red('✖')} ${formatSchemaError(context.error)}`,
    );
    activeRequests.delete(context.id);
  });
  events.on('task:cleanup', (context) => {
    activeRequests.delete(context.id);
    p.outro(`${color.green('✔')} Cleaned up tasks`)
  });

    // --- SERVER STARTUP (AFTER LISTENERS) ---

  try {
    s.start(promptMessages[0] + '\n');

    // Initialize the API server
    const { server, store } = await createPromptServer();

    console.log('\n');
    s.stop(color.green('Server started successfully!'));

    // Start initial server
    httpServer = server.listen(port, () => {
      console.log(`\nDevelopment server started on ${color.cyan(`http://localhost:${port}`)}`);

      const routeList = formatRoutes(store.routes.all('next'), port);
      console.log('\nAvailable routes:\n' + routeList + '\n');

      const taskList = formatTasks(store.tasks.all())
      console.log('Available tasks:\n' + taskList + '\n')
    });

    const shutdown = () => {
      if (httpServer) {
        httpServer.close(async () => {
          p.outro('Development server stopped');
          store.tasks.cleanup();
          process.exit(0);
        });
      } else {
        p.outro('Development server stopped');
        process.exit(0);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.log({ error })
    s.stop(color.red('Failed to start server'));
    p.log.error(String(error));
    process.exit(1);
  }
}
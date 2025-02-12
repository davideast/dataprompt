#!/usr/bin/env node
import * as p from '@clack/prompts';
import color from 'picocolors';
import { createProject } from './commands/create.js';
import { devCommand } from './commands/dev.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.clear();
  p.intro(`${color.bgCyan(color.black(' dataprompt '))}`);

  switch (command) {
    case 'create':
      if (!args[1]) {
        console.log(`
Usage:
  ${color.green('dataprompt create <project-name>')}
        `);
        process.exit(1);
      }
      await createProject(args[1]);
      break;

    case 'dev':
      await devCommand();
      break;

    default:
      console.log(`
Commands:
  ${color.green('create <project-name>')}  Create a new dataprompt project
  ${color.green('dev')}                    Start development server
      `);
      process.exit(1);
  }
}

// This is what makes the CLI executable
main().catch((error) => {
  console.error(color.red('Error:'), error);
  process.exit(1);
});

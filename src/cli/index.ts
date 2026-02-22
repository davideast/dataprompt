#!/usr/bin/env node
import * as p from '@clack/prompts';
import color from 'picocolors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { CliCommand } from './interfaces.js';

async function main() {
  const args = process.argv.slice(2);
  const commandName = args[0];

  console.clear();
  p.intro(`${color.bgCyan(color.black(' dataprompt '))}`);

  const commands = new Map<string, CliCommand>();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const commandsDir = path.join(__dirname, 'commands');

  // Load commands
  try {
    const files = await fs.readdir(commandsDir);
    for (const file of files) {
      if ((file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts')) {
        try {
            const modulePath = path.join(commandsDir, file);
            // Use pathToFileURL to ensure Windows compatibility for dynamic imports
            const mod = await import(pathToFileURL(modulePath).toString());
            // Expect named export 'command' or default export
            const exportCmd = mod.command || mod.default;
            if (exportCmd && typeof exportCmd.name === 'string' && typeof exportCmd.run === 'function') {
                const cmd = exportCmd as CliCommand;
                commands.set(cmd.name, cmd);
            }
        } catch (e) {
            // Ignore files that are not valid commands or fail to load
            // console.error(`Failed to load command from ${file}`, e);
        }
      }
    }
  } catch (e) {
      console.error('Failed to load commands directory', e);
  }

  if (commands.has(commandName)) {
      try {
        // Pass args slice(1) which are args AFTER the command name
        await commands.get(commandName)!.run(args.slice(1));
      } catch (error) {
          console.error(color.red('Error running command:'), error);
          process.exit(1);
      }
  } else {
      console.log(`
Commands:
${Array.from(commands.values()).map(c => `  ${color.green(c.usage || c.name).padEnd(30)}  ${c.description}`).join('\n')}
      `);
      process.exit(1);
  }
}

// This is what makes the CLI executable
main().catch((error) => {
  console.error(color.red('Error:'), error);
  process.exit(1);
});

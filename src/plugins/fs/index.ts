import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'os';
import { FileSystemPluginConfig, FileSystemReadConfig, FileSystemWriteConfig, WriteOperationType } from './types.js'
import { fetchData } from './source.js';
import { execute } from './actions.js';
import {
  DataSourceProvider,
  DataActionProvider,
  DatapromptPlugin,
  RequestContext,
  DatapromptFile,
} from '../../core/interfaces.js';

export function fsPlugin(pluginConfig: FileSystemPluginConfig = {}): DatapromptPlugin {
  const name = 'fs';
  // Determine the sandbox path
  const sandboxPath = createSandboxDirectory(pluginConfig);

  return {
    name,
    createDataSource(): DataSourceProvider {
      return {
        name,
        async fetchData(params: {
          request: RequestContext;
          config: string | FileSystemReadConfig;
          file: DatapromptFile;
        }): Promise<Record<string, any> | Buffer | string> {
          return fetchData(params, sandboxPath);
        },
      };
    },
    createDataAction(): DataActionProvider {
      return {
        name,
        async execute(params: {
          request: RequestContext;
          config: Record<WriteOperationType, FileSystemWriteConfig | FileSystemWriteConfig[]>;
          promptSources: Record<string, any>;
          file: DatapromptFile;
        }): Promise<void> {
          return execute(params, sandboxPath)
        },
      };
    },
  };
}

function createSandboxDirectory(pluginConfig: FileSystemPluginConfig = {}) {
  // Determine the sandbox path:
  const defaultSandboxPath = path.join(os.tmpdir(), 'dataprompt-sandbox');
  const sandboxPath = path.resolve(pluginConfig.sandboxPath || defaultSandboxPath);
  // Create the sandbox directory if it doesn't exist.
  if (!fs.existsSync(sandboxPath)) {
    try {
      fs.mkdirSync(sandboxPath, { recursive: true });
    } catch (err) {
      console.error(`Failed to create sandbox directory at ${sandboxPath}:`, err);
      throw err;
    }
  }

  return sandboxPath;
}

// Only allows access within the sandbox.
export function resolveFilePath(filePath: string, sandboxPath: string): string {
  // Resolve the requested file path relative to the sandbox directory.
  const resolvedPath = path.resolve(sandboxPath, filePath);

  // Ensure the resolved path is within the sandbox.
  if (!resolvedPath.startsWith(sandboxPath)) {
    throw new Error(
      `File access outside of sandbox directory: ${filePath}. Resolved Path: ${resolvedPath}`
    );
  }
  return resolvedPath;
}


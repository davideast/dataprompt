import {
  DataSourceProvider,
  DataActionProvider,
  DatapromptPlugin,
  RequestContext,
  DatapromptFile,
} from '../../core/interfaces.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import os from 'os';

export interface FileReadConfig {
  path: string;
  format?: 'text' | 'json' | 'csv' | 'auto' | 'binary';
  encoding?: BufferEncoding | 'buffer';
  watch?: boolean;
  start?: number;
  end?: number;
  allowOutside?: boolean; // New option: Allow access outside prompt dir (but still within sandbox)
}

export interface FileWriteConfig {
  path: string;
  mode?: 'overwrite' | 'append' | 'create';
  encoding?: BufferEncoding | 'buffer';
  format?: 'text' | 'json' | 'csv';
  source?: string;
}

export interface FilePluginConfig {
  sandboxPath?: string;
}

export function filePlugin(pluginConfig: FilePluginConfig = {}): DatapromptPlugin {
  const name = 'file';
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

  return {
    name,
    createDataSource(): DataSourceProvider {
      return {
        name,
        async fetchData(params: {
          request: RequestContext;
          config: string | FileReadConfig;
          file: DatapromptFile;
        }): Promise<Record<string, any>> {
          return fetchData(params, sandboxPath);
        },
      };
    },
    createDataAction(): DataActionProvider {
      return {
        name,
        async execute(params: {
          request: RequestContext;
          config: FileWriteConfig;
          promptSources: Record<string, any>;
        }): Promise<void> {
          throw new Error('File write not implemented yet.');
        },
      };
    },
  };
}

function resolveFilePath(promptFilePath: string, filePath: string, sandboxPath: string, allowOutside: boolean = false): string {
  const promptDir = path.dirname(promptFilePath);
  let resolvedPath = path.resolve(promptDir, filePath);

  // 1. Try route-based access:
  if (resolvedPath.startsWith(promptDir)) {
    // Allowed: within prompt's directory
    return resolvedPath; 
  }

  // 2. If route-based access fails AND allowOutside is true, use sandbox:
  if (allowOutside) {
    // Resolve relative to SANDBOX
    resolvedPath = path.resolve(sandboxPath, filePath);
    if (!resolvedPath.startsWith(sandboxPath)) {
      throw new Error(
        `File access outside of sandbox directory: ${filePath}. Resolved Path: ${resolvedPath}`
      );
    }
    return resolvedPath;
  }

  // 3. If neither route-based nor sandbox access is allowed: DENY
  throw new Error(
    `File access outside of allowed directory: ${filePath}. Resolved Path: ${resolvedPath}`
  );
}

async function fetchData(params: {
  request: RequestContext;
  config: string | FileReadConfig;
  file: DatapromptFile;
}, sandboxPath: string): Promise<Record<string, any>> {
  const { config, file } = params;
  const fileConfig: FileReadConfig =
    typeof config === 'string' ? { path: config } : config;

  const promptFilePath = file.path;

  // Use the resolveFilePath with allowOutside option:
  const filePath = resolveFilePath(
    promptFilePath, 
    fileConfig.path, 
    sandboxPath, fileConfig.allowOutside
  );
  const format = fileConfig.format || 'auto';
  const encoding = fileConfig.encoding || (format === 'binary' ? 'buffer' : 'utf8');

  try {
    if (format === 'binary') {
      return streamFileAsBinary(filePath, fileConfig);
    }
    const fileStream = fs.createReadStream(filePath, {
      encoding: encoding === 'buffer' ? undefined : (encoding as BufferEncoding),
      start: fileConfig.start,
      end: fileConfig.end,
    });

    if (format === 'json') {
      return streamFileAsJSON(fileStream, encoding);
    } else if (format === 'auto') {
      const fileExtension = path.extname(filePath).toLowerCase();
      if (fileExtension === '.json') {
        return streamFileAsJSON(fileStream, encoding);
      } else {
        return streamFileAsText(fileStream, encoding);
      }
    } else {
      return streamFileAsText(fileStream, encoding);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    } else if (error.code === 'EACCES') {
      throw new Error(`Permission denied: ${filePath}`);
    } else {
      throw new Error(`Error reading file ${filePath}: ${error.message}`);
    }
  }
}

async function streamFileAsText(
  fileStream: Readable,
  encoding: string | undefined
): Promise<Record<string, any>> {
  let content = '';
  if (encoding === 'buffer') {
    throw new Error('Encoding buffer is invalid for streamFileAsText');
  }
  for await (const chunk of fileStream) {
    content += chunk;
  }
  return { content };
}

async function streamFileAsJSON(
  fileStream: Readable,
  encoding: string | undefined
): Promise<Record<string, any>> {
  if (encoding === 'buffer') {
    throw new Error('Encoding buffer is invalid for streamFileAsJSON');
  }
  const textContent = await streamFileAsText(fileStream, encoding);
  try {
    const data = JSON.parse(textContent.content);
    return Array.isArray(data) ? { items: data } : data;
  } catch (error: any) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

async function streamFileAsBinary(filePath: string, fileConfig: FileReadConfig): Promise<Record<string, any>> {
  const fileStream = fs.createReadStream(filePath, { start: fileConfig.start, end: fileConfig.end });
  const chunks: Buffer[] = [];

  for await (const chunk of fileStream) {
    chunks.push(chunk as Buffer);
  }
  return { content: Buffer.concat(chunks) };
}

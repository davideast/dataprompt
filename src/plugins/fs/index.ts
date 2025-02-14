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
  format?: 'text' | 'json' | 'auto' | 'binary';
  encoding?: BufferEncoding | 'buffer';
  watch?: boolean;
  start?: number;
  end?: number;
}

export interface FileWriteConfig {
  path: string;
  mode?: 'overwrite' | 'append' | 'create';
  encoding?: BufferEncoding | 'buffer';
  format?: 'text' | 'json';
  source?: string;
}

export interface FsPluginConfig {
  sandboxPath?: string;
}

export function fsPlugin(pluginConfig: FsPluginConfig = {}): DatapromptPlugin {
  const name = 'fs';
  // Determine the sandbox path:
  const defaultSandboxPath = path.join(os.tmpdir(), 'dataprompt-sandbox');
  const sandboxPath = path.resolve(pluginConfig.sandboxPath || defaultSandboxPath);
  console.log({ defaultSandboxPath })
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
        }): Promise<Record<string, any> | string> { 
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

// Only allows access within the sandbox.
function resolveFilePath(filePath: string, sandboxPath: string): string {
  // Resolve the requested file path relative to the sandbox directory.
  const resolvedPath = path.resolve(sandboxPath, filePath);

  // Ensure the resolved path is *within* the sandbox.
  if (!resolvedPath.startsWith(sandboxPath)) {
    throw new Error(
      `File access outside of sandbox directory: ${filePath}. Resolved Path: ${resolvedPath}`
    );
  }
  return resolvedPath;
}

async function fetchData(params: {
  request: RequestContext;
  config: string | FileReadConfig;
  file: DatapromptFile;
}, sandboxPath: string): Promise<Record<string, any> | string> {
  const { config, file } = params;
  const fsConfig: FileReadConfig =
    typeof config === 'string' ? { path: config } : config;

  if (!file?.absolutePath) {
    throw new Error("Prompt file path is required for file operations.");
  }

  const filePath = resolveFilePath(fsConfig.path, sandboxPath);
  const format = fsConfig.format || 'auto';
  const encoding = fsConfig.encoding || (format === 'binary' ? 'buffer' : 'utf8');

  try {
    if (format === 'binary') {
      return streamFileAsBinary(filePath, fsConfig);
    }

    const fileStream = fs.createReadStream(filePath, {
      encoding: encoding === 'buffer' ? undefined : (encoding as BufferEncoding),
      start: fsConfig.start,
      end: fsConfig.end,
    });

    if (format === 'json') {
      return streamFileAsJSON(fileStream, encoding);
    } else if (format === 'auto') {
      // Attempt to auto-detect the format.
      const fileExtension = path.extname(filePath).toLowerCase();
      if (fileExtension === '.json') {
        return streamFileAsJSON(fileStream, encoding);
      } else {
        // Default to text if auto-detection fails.
        return streamFileAsText(fileStream, encoding);
      }
    } else { 
      // format === 'text' or any other non-binary format
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
): Promise<string> {
  let content = '';
  if (encoding === 'buffer') {
    throw new Error('Encoding buffer is invalid for streamFileAsText');
  }
  for await (const chunk of fileStream) {
    content += chunk;
  }
  return content;
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
    const data = JSON.parse(textContent);
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
  return Buffer.concat(chunks);
}

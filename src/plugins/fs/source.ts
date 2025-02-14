import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { resolveFilePath } from './index.js';
import { FileSystemReadConfig } from './types.js'
import { RequestContext, DatapromptFile } from '../../core/interfaces.js';

export async function fetchData(params: {
  request: RequestContext;
  config: string | FileSystemReadConfig;
  file: DatapromptFile;
}, sandboxPath: string): Promise<Record<string, any> | Buffer | string> {
  const { config, file } = params;
  const fsConfig: FileSystemReadConfig =
    typeof config === 'string' ? { path: config } : config;

  if (!file?.absolutePath) {
    throw new Error("Prompt file path is required for file operations.");
  }

  // Call resolveFilePath with ONLY the sandboxPath
  const filePath = resolveFilePath(fsConfig.path, sandboxPath);
  const format = fsConfig.format || 'auto';
  const encoding = fsConfig.encoding || (format === 'binary' ? 'buffer' : 'utf8');

  try {
    return await readFileContent(filePath, format, encoding, fsConfig);
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

async function readFileContent(
  filePath: string,
  format: 'text' | 'json' | 'csv' | 'auto' | 'binary',
  encoding: BufferEncoding | 'buffer',
  fsConfig: FileSystemReadConfig,
): Promise<Record<string, any> | Buffer | string> {
  if (format === 'binary') {
    return streamFileAsBinary(filePath, fsConfig);
  }

  const fileStream = fs.createReadStream(filePath, {
    encoding: encoding === 'buffer' ? undefined : (encoding as BufferEncoding),
    start: fsConfig.start,
    end: fsConfig.end,
  });

  switch (format) {
    case 'json':
      return streamFileAsJSON(fileStream, encoding);
    case 'auto':
      const fileExtension = path.extname(filePath).toLowerCase();
      if (fileExtension === '.json') {
        return streamFileAsJSON(fileStream, encoding);
      } else {
        return streamFileAsText(fileStream, encoding);
      }
    case 'text':
      return streamFileAsText(fileStream, encoding);
    default:
      // Handle 'text' and any unknown formats as text
      return streamFileAsText(fileStream, encoding);
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

async function streamFileAsBinary(
  filePath: string, 
  fileConfig: FileSystemReadConfig
): Promise<Buffer> {
  const { start, end } = fileConfig;
  const fileStream = fs.createReadStream(filePath, { start, end });
  const chunks: Buffer[] = [];

  for await (const chunk of fileStream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

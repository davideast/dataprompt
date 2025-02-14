import * as fs from 'node:fs/promises';
import { RequestContext, DatapromptFile } from '../../core/interfaces.js';
import { resolveFilePath } from './index.js';
import { 
  FileSystemWriteConfig, 
  FileSystemWriteConfigConcise, 
  WriteOperationType, 
  Operation, 
  FileSystemWriteConfigVerbose 
} from './types.js';

function isFileSystemWriteConfigConcise(config: FileSystemWriteConfig | string): config is FileSystemWriteConfigConcise {
  return Array.isArray(config);
}

interface NormalizedWriteConfig {
  path: string;
  source: string;
  encoding?: BufferEncoding | 'buffer';
  format?: 'text' | 'json' | 'binary';
  type: WriteOperationType;
}

export async function execute(params: {
  request: RequestContext;
  config: Record<WriteOperationType, FileSystemWriteConfig | FileSystemWriteConfig[]>;
  promptSources: Record<string, any>;
  file: DatapromptFile;
}, sandboxPath: string): Promise<void> {

  const { config, promptSources } = params;
  const operations: Operation[] = [];

  // Normalize and validate configuration:
  for (const operationType in config) {
    if (!['overwrite', 'append', 'create', 'create-or-overwrite'].includes(operationType)) {
      throw new Error(`Invalid operation type: ${operationType}`);
    }
    const opConfigs = config[operationType as WriteOperationType];

    if (opConfigs === undefined) {
      continue;
    }

    // Configure if it's a concise or verbose format
    /*
      Concise:
      result:
        fs:
          write:
            - [path, source]

      Verbose:
      result:
        fs:
          write:
            path: 
            source:
            format:
    */
    const configArray = 
      Array.isArray(opConfigs) ? 
      opConfigs as [FileSystemWriteConfigConcise]: 
      [opConfigs] as FileSystemWriteConfigVerbose[];

    for (const writeConfig of configArray) {
      // Normalize to a common internal representation
      const normalized = normalizeWriteConfig(
        writeConfig,
        operationType as WriteOperationType,
        sandboxPath
      );
      operations.push({
        type: normalized.type,
        filePath: normalized.path,
        source: normalized.source,
        encoding: normalized.encoding,
        format: normalized.format,
      });
    }
  }


  // Execute normalized operations
  for (const op of operations) {
    const data = resolveSource(promptSources, op.source);
    if (data === undefined) {
      throw new Error(`Data source '${op.source}' not found.`);
    }

    // Auto detect string or object
    if (op.format === undefined) {
      op.format = typeof data === 'object' && data !== null ? 'json' : 'text';
    }

    let dataToWrite: string | Buffer;
    if (op.format === 'binary') {
      if (!Buffer.isBuffer(data)) {
        throw new Error(`Invalid data type for binary format, must be a Buffer.`);
      }
      dataToWrite = data;
    } else if (op.format === 'json') {
      dataToWrite = JSON.stringify(data, null, 2);
    } else {
      throw new Error(`Invalid data type for text format, must be a string, received: ${typeof data}`);
    }

    try {
      switch (op.type) {
        case 'overwrite':
        case 'create-or-overwrite':
          await fs.writeFile(op.filePath, dataToWrite, { encoding: op.encoding === 'buffer' ? undefined : op.encoding });
          break;
        case 'append':
          await fs.appendFile(op.filePath, dataToWrite, { encoding: op.encoding === 'buffer' ? undefined : op.encoding });
          break;
        case 'create':
          // 'wx': write, fail if exists
          const handle = await fs.open(op.filePath, 'wx'); 
          await handle.writeFile(dataToWrite, { encoding: op.encoding === 'buffer' ? undefined : op.encoding });
          await handle.close();
          break;
      }
    } catch (error: any) {
      if (op.type === 'create' && error.code === 'EEXIST') {
        throw new Error(`File already exists: ${op.filePath} (mode: 'create')`);
      }
      const errorMessage = `Error writing to file ${op.filePath}: ${error.message} with type ${op.type} and format ${op.format}`;
      throw new Error(errorMessage);
    }
  }
}

function normalizeWriteConfig(
  config: FileSystemWriteConfig,
  operationType: WriteOperationType,
  sandboxPath: string
): NormalizedWriteConfig {
  if (isFileSystemWriteConfigConcise(config)) {
    // Handle concise format
    const [path, source] = config;
    return {
      path: resolveFilePath(path, sandboxPath),
      source,
      encoding: 'utf8',
      type: operationType
      // format: is auto when undefined
    };
  } else {
    config = config as FileSystemWriteConfigVerbose;
    // Handle verbose format
    if (!config.path || !config.source) {
      throw new Error(`Invalid verbose configuration: ${JSON.stringify(config)}. Must include 'path' and 'source'.`);
    }
    if (config.format === 'binary' && config.encoding !== 'buffer') {
      throw new Error('Binary format needs encoding to be set to buffer')
    }
    let format = config.format;
    return {
      path: resolveFilePath(config.path, sandboxPath),
      source: config.source,
      encoding: config.encoding,
      format,
      type: operationType
    };
  }
}

// Handle object notation -> "output.message"
function resolveSource(sources: Record<string, any>, sourceString: string): any {
  const pathSegments = sourceString.split('.');
  let current = sources;

  for (const segment of pathSegments) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment];
    }
    else if (Array.isArray(current) && /^\d+$/.test(segment)) {
      const index = parseInt(segment, 10)
      if (index < current.length) {
        current = current[index];
      } else {
        throw new Error(`Invalid source path: ${sourceString}`);
      }
    }
    else {
      throw new Error(`Invalid source path: ${sourceString}`);
    }
  }

  return current;
}

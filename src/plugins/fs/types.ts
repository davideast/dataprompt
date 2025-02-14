export interface FileSystemReadConfig {
  path: string;
  format?: 'text' | 'json' | 'auto' | 'binary';
  encoding?: BufferEncoding | 'buffer';
  watch?: boolean;
  start?: number;
  end?: number;
}

/*

*/
export interface FileSystemWriteConfigVerbose {
  path: string;
  encoding?: BufferEncoding | 'buffer';
  format?: 'text' | 'json' | 'binary';
  source: string;
}

// [filePathInsideSandbox, sourceVariable]
// - [message.txt, output]
export type FileSystemWriteConfigConcise = [string, string];

// Unify both for both syntaxes
export type FileSystemWriteConfig = FileSystemWriteConfigVerbose | FileSystemWriteConfigConcise;

export interface FileSystemPluginConfig {
  sandboxPath?: string;
}

export type WriteOperationType = 'overwrite' | 'append' | 'create' | 'create-or-overwrite';

// Internal Operation type used by execute
export interface Operation {
  type: WriteOperationType;
  filePath: string;
  source: string;
  encoding: BufferEncoding | 'buffer' | undefined;
  format: 'text' | 'json' | 'binary' | undefined;
}


// type WriteOperation = 'overwrite' | 'append' | 'create' | 'create-or-overwrite';

// interface FileSystemWriteOperation {
//   type: WriteOperation;
//   filePath: string;
//   source: string;
//   encoding: BufferEncoding | 'buffer' | undefined;
//   format: 'text' | 'json' | 'auto' | 'binary' | undefined;
// }

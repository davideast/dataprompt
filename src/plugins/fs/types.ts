export interface FileSystemReadConfig {
  path: string;
  format?: 'text' | 'json' | 'auto' | 'binary';
  encoding?: BufferEncoding | 'buffer';
  watch?: boolean;
  start?: number;
  end?: number;
}

export interface FileSystemWriteConfig {
  path: string;
  mode?: 'overwrite' | 'append' | 'create';
  encoding?: BufferEncoding | 'buffer';
  format?: 'text' | 'json';
  source?: string;
}

export interface FileSystemPluginConfig {
  sandboxPath?: string;
}
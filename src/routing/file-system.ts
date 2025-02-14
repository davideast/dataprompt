import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatapromptFile } from '../core/interfaces.js';

export function filePathToExpressParams({ filePath, basePath }: { filePath: string; basePath: string }): string {
  return filePath
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/(\.prompt)$/, '')
    .replace(basePath, '');
}

export async function readFilesRecursively(directoryPath: string): Promise<DatapromptFile[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files: DatapromptFile[] = [];

  for (const entry of entries) {
    const promptPath = join(directoryPath, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...(await readFilesRecursively(promptPath)));
    } else if (entry.isFile() && entry.name.endsWith('.prompt')) {
      try {
        const absolutePath = resolve(directoryPath, entry.name)
        const content = await fs.readFile(promptPath, {
          encoding: 'utf-8',
          // TODO(davideast): remember that 'r+' works well in HMR
          flag: 'r' 
        });
        const nextRoute = extractNextRoute(promptPath);
        files.push({ path: promptPath, content, nextRoute, absolutePath });
      } catch (error) {
        // TODO(davideast): consider centralized error handling
        throw error;
      }
    }
  }
  return files;
}

function extractNextRoute(path: string) {
  const promptsIndex = path.indexOf('/prompts/');
  let extractedPath = path.substring(promptsIndex + '/prompts/'.length);
  if (extractedPath.endsWith('.prompt')) {
    extractedPath = extractedPath.slice(0, -'.prompt'.length);
  }
  return extractedPath;
}

export async function createFileMap(basePath: string) {
  const files = await readFilesRecursively(basePath);
  const fileMap: Map<string, DatapromptFile> = new Map();

  for (const file of files) {
    const expressPath = filePathToExpressParams({
      filePath: file.path,
      basePath,
    });
    fileMap.set(expressPath, file)
  }
  return fileMap;
}
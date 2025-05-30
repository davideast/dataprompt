import path from 'path';
import { fileURLToPath } from 'url';
import { findUpSync } from 'find-up'

// import.meta.url
export function findTestRoot(filePath: string | URL) {
  const currentFilePath = fileURLToPath(filePath);
  return findUpSync('tests', {
    cwd: path.dirname(currentFilePath),
    type: 'directory'
  })!;
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const FROZEN_FILES = [
  'src/core/dataprompt.ts',
  'src/core/plugin.manager.ts',
  'src/core/interfaces.ts',
  'src/index.ts',
];

const MAX_LINES = 300;
const IGNORED_LARGE_FILES = [
  'src/context/index.ts',
];

function getChangedFiles(): string[] {
  try {
    // If running in CI, GITHUB_BASE_REF is set.
    const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main';

    // Check if we are in a git repo
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    } catch {
      console.warn('Not a git repository. Skipping modified file checks.');
      return [];
    }

    // specific check for local dev environment where origin/main might be missing
    if (!process.env.GITHUB_BASE_REF) {
      try {
        execSync(`git rev-parse --verify ${baseRef}`, { stdio: 'ignore' });
      } catch {
         console.warn(`Base ref ${baseRef} not found. Skipping frozen file checks.`);
         return [];
      }
    }

    const command = `git diff --name-only ${baseRef}...HEAD`;
    const output = execSync(command).toString();

    // Check for uncommitted changes too (for local development)
    let uncommittedOutput = '';
    try {
        uncommittedOutput = execSync('git diff --name-only').toString();
    } catch (e) {
        // Ignore error if basic git diff fails (unlikely if inside work tree)
    }

    // Check for staged changes too
    let stagedOutput = '';
    try {
        stagedOutput = execSync('git diff --name-only --cached').toString();
    } catch (e) {
    }

    const allFiles = new Set([
        ...output.split('\n').filter(Boolean),
        ...uncommittedOutput.split('\n').filter(Boolean),
        ...stagedOutput.split('\n').filter(Boolean)
    ]);

    return Array.from(allFiles);
  } catch (error) {
    console.error('Error getting changed files:', error);
    return [];
  }
}

function checkFrozenFiles(changedFiles: string[]) {
  const modifiedFrozen = changedFiles.filter(file => FROZEN_FILES.includes(file));
  if (modifiedFrozen.length > 0) {
    console.warn('\x1b[33m%s\x1b[0m', 'WARNING: The following frozen core files have been modified:');
    modifiedFrozen.forEach(file => console.warn(`  - ${file}`));
    console.warn('  Please ensure these changes are necessary and reviewed carefully.');
  }
}

function getAllTsFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllTsFiles(filePath, fileList);
    } else {
      if (filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

function checkFileSizes() {
  const files = getAllTsFiles('src');
  const largeFiles: string[] = [];

  files.forEach(file => {
    const normalizedFile = file.split(path.sep).join('/');
    if (IGNORED_LARGE_FILES.some(ignored => normalizedFile.includes(ignored))) {
      return;
    }
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;
    if (lines > MAX_LINES) {
      largeFiles.push(`${file} (${lines} lines)`);
    }
  });

  if (largeFiles.length > 0) {
    console.error('\x1b[31m%s\x1b[0m', `ERROR: The following files exceed the ${MAX_LINES} line limit:`);
    largeFiles.forEach(file => console.error(`  - ${file}`));
    console.error('  Please refactor these files to be smaller.');
    process.exit(1);
  }
}

function run() {
  console.log('Running conflict detection checks...');

  const changedFiles = getChangedFiles();
  checkFrozenFiles(changedFiles);

  checkFileSizes();

  console.log('Conflict checks completed.');
}

run();

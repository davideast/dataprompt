# dataprompt AGENTS.md

## Project Overview
Dataprompt is a metaframework for prompt files, combining prompt engineering with file-based routing. It allows creating self-contained "Single File Prompts" (`.prompt` files) that define prompts, data sources, and post-generation actions.

- **Stack**: TypeScript, Node.js (v20+), Genkit, Google AI (Gemini).
- **Key Features**: File-based routing, Data Sources (fetch, firestore, fs), Data Actions (result), Scheduled Tasks (cron).

## Dev Environment Tips
- **Install Dependencies**: `npm install`
- **Build Project**: `npm run build` (runs `tsc` and `chmod` on CLI).
- **Dev Server**: `npx dataprompt dev` (starts the dev server).
- **Create Project**: `npx dataprompt create <project-dir>` (scaffolds a new project).
- **Pack for local testing**: `npm run packx` (builds and installs into `./examples`).

## Testing Instructions
- **Run All Tests**: `npm test` (runs Vitest).
- **Run Specific Test**: `npm test -- -t "<test pattern>"` (e.g., `npm test -- -t "server"`).
- **Watch Mode**: `npm test -- --watch`
- **Test Structure**:
    - `tests/unit`: Unit tests for individual components.
    - `tests/integration`: Integration tests (requires valid keys).
- **Environment Variables**:
    - Integration tests require `GOOGLEAI_API_KEY` and `GOOGLE_APPLICATION_CREDENTIALS`.
    - Note: The CI workflow only runs tests when the `run-tests` label is applied to a PR.

## Code Style & Standards
- **Language**: TypeScript (ES Modules).
- **Formatting**: Adhere to existing code style.
- **Imports**: Use explicit extensions for relative imports in ES modules (e.g., `import { foo } from './bar.js'`).
- **File Structure**:
    - `src/core`: Core logic (config, plugin manager, prompt handling).
    - `src/plugins`: Built-in plugins (fetch, firebase, fs, scheduler).
    - `src/routing`: Routing and server logic.
    - `src/cli`: CLI commands.

## PR Instructions
- **Title Format**: Conventional Commits (e.g., `feat: add new plugin`, `fix: resolve routing issue`).
- **Before Committing**: Ensure `npm run build` passes and `npm test` (unit tests at least) passes.
- **New Dependencies**: If adding a new dependency, ensure it is necessary and compatible with the project's license (Apache-2.0).

## Security Considerations
- **Secrets**: Never commit API keys or service account files. Use environment variables.
- **FS Plugin**: The `fs` plugin has a `sandboxDir` option. Ensure this is always configured to a safe directory in tests and examples to prevent arbitrary file system access.

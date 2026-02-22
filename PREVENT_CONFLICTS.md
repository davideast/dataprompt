# Preventing Merge Conflicts and Improving Productivity

This document outlines strategies to minimize merge conflicts and improve productivity, specifically designed to support parallel development by both human developers and AI agents. The goal is to create a robust, modular codebase where changes can be made independently with minimal friction.

## Analysis of Current State

### 1. Plugin Management
**Issue:** The `PluginManager` class in `src/core/plugin.manager.ts` and the `dataprompt` function in `src/core/dataprompt.ts` contain hardcoded logic for registering default plugins (e.g., Firestore, Fetch, Scheduler).
**Impact:** Adding or modifying default plugins requires editing these central files, creating a high risk of merge conflicts when multiple agents attempt to add different plugins simultaneously.
**Recommendation:** Refactor plugin registration to use a dynamic discovery mechanism similar to the CLI command loader, or a configuration-driven approach where default plugins are defined in a separate configuration file or module that can be extended without modifying the core logic.

### 2. Type Safety
**Issue:** The codebase frequently uses `any` types, particularly in `src/core/interfaces.ts` (e.g., `generate<Output = any>`, `provideGenkitPlugins?(): any[]`, `config: any`).
**Impact:** `any` types bypass TypeScript's safety checks, increasing the likelihood of runtime errors that are difficult to debug and resolve during merges. It also reduces the effectiveness of automated refactoring tools.
**Recommendation:**
*   Replace `any` with specific types or generics where possible.
*   Use `unknown` for truly dynamic content and enforce runtime validation (e.g., using Zod schemas) before usage.
*   Define stricter interfaces for plugin configuration and output.

### 3. Barrel Files
**Issue:** `src/index.ts` serves as a main entry point, exporting functionality from various modules.
**Impact:** While convenient for consumers, extensive use of barrel files can lead to conflicts if every new feature requires an addition to this file. It can also cause circular dependency issues.
**Recommendation:**
*   Minimize the use of barrel files for internal development.
*   Encourage importing directly from specific modules when possible within the library.
*   Automate the generation of `index.ts` if it becomes too frequent a conflict source, or use a tool to manage exports.

### 4. CLI Command Registration
**Strength:** The CLI implementation in `src/cli/index.ts` uses a dynamic command loading pattern, reading files from the `commands/` directory.
**Impact:** This is an excellent pattern for preventing conflicts. Adding a new command only requires creating a new file, with no changes needed to the central `index.ts` runner.
**Recommendation:** Maintain this pattern and apply it to other areas of the codebase, such as plugin registration and route handling.

### 5. Large Files and Responsibilities
**Issue:** `src/core/dataprompt.ts` handles multiple responsibilities: configuration merging, Genkit initialization, schema loading, and manager creation.
**Impact:** Large files are conflict magnets. A change in initialization logic might conflict with a change in configuration handling.
**Recommendation:**
*   Break down `dataprompt.ts` into smaller, focused modules (e.g., `ConfigLoader`, `GenkitInitializer`, `RouteSetup`).
*   Extract the `createDefaultGenkit` logic into a dedicated factory or provider.

## Discrete Action Items

### Immediate Actions
1.  [x] **Refactor Plugin Registration**: Modify `PluginManager` to accept a list of plugins without hardcoding defaults in the class itself. Move default plugin logic to a separate `DefaultPlugins` module. (Completed 2025-02-18)
2.  **Harden Types**: systematically review `src/core/interfaces.ts` and replace `any` with generic types or `unknown` with validation. specifically target `RequestContext`, `DataSourceProvider`, and `DataActionProvider`.
3.  **Decompose `dataprompt.ts`**: Extract `createDefaultGenkit` and `loadUserGenkitInstance` into a separate `GenkitFactory` module.

### Long-term Strategy
1.  **Adopt "Open for Extension, Closed for Modification"**: Design core classes to accept extensions (plugins, commands, routes) without requiring modification to the class source code.
2.  **Automated Conflict Detection**: Implement pre-commit hooks or CI checks that flag potential conflict areas (e.g., large files, modification of frozen core files).
3.  **Enhanced Testing**: Add unit tests specifically for the plugin registration and configuration loading logic to ensure refactoring doesn't introduce regressions.

## Conclusion
By moving towards dynamic registration, stricter typing, and smaller, single-responsibility modules, the `dataprompt` library can significantly reduce the overhead of merge conflicts and enable seamless parallel development.

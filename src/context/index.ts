#!/usr/bin/env tsx
import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import { fileURLToPath } from 'url'; // Import fileURLToPath

const extensions = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx"];
const typeExtensions = [".d.ts", ".d.mts", ".d.cts"];

// --- Utility Functions ---

/**
 * Resolves a file path, handling various extensions and index files.
 */
async function resolveFile(filePath: string, currentDir: string): Promise<string | null> {
    const absolutePath = path.resolve(currentDir, filePath);

    // 1. Try the path exactly as provided.
    try {
        await fs.access(absolutePath);
        return absolutePath;
    } catch { }

    // 2. If .js, .cjs, or .mjs, try .ts, .cts, .mts, .tsx, .jsx
    const ext = path.extname(absolutePath);
    if ([".js", ".cjs", ".mjs"].includes(ext)) {
        const tsExtensions = [".ts", ".cts", ".mts", ".tsx", ".jsx"];
        for (const tsExt of tsExtensions) {
            const tsPath = absolutePath.slice(0, -ext.length) + tsExt;
            try {
                await fs.access(tsPath);
                return tsPath;
            } catch { }
        }
    }

    // 3.  If no extension, try all extensions.
    if (ext === '') {
        for (const ext of extensions) {
            const fullPath = absolutePath + ext;
            try {
                await fs.access(fullPath);
                return fullPath;
            } catch { }
        }
    }

    // 4. Try as a directory with index file, for all extensions.
    for (const ext of extensions) {
        const indexPath = path.join(absolutePath, `/index${ext}`);
        try {
            await fs.access(indexPath);
            return indexPath;
        } catch { }
    }

    return null; // File not found
}

/**
 * Resolves type definitions for external modules (e.g., from node_modules/@types or package.json).
 */
async function resolveTypeDefinition(moduleName: string, currentDir: string): Promise<string | null> {
    const typesPackagePath = path.resolve(currentDir, 'node_modules', '@types', moduleName);
    const moduleIndexPath = path.resolve(currentDir, 'node_modules', moduleName, 'index.d.ts');
    const modulePackageJson = path.resolve(currentDir, 'node_modules', moduleName, 'package.json');

    // Check @types first
    for (const typeExt of typeExtensions) {
        const checkPath = typesPackagePath + typeExt
        try {
            await fs.access(checkPath)
            return checkPath;
        } catch { }
    }
    try {
        const typesIndexPath = path.join(typesPackagePath, "index.d.ts");
        await fs.access(typesIndexPath);
        return typesIndexPath;
    } catch { }

    // If not in @types, try the module's own index.d.ts
    for (const typeExt of typeExtensions) {
        const checkPath = moduleIndexPath + typeExt
        try {
            await fs.access(checkPath)
            return checkPath;
        } catch { }
    }

    // Try using the package.json types or typing property.
    try {
        const packageJson = JSON.parse(await fs.readFile(modulePackageJson, 'utf-8'));
        const typesPath = packageJson.types || packageJson.typings;
        if (typesPath) {
            const resolvedTypesPath = path.resolve(path.dirname(modulePackageJson), typesPath);

            if (path.extname(resolvedTypesPath) === '') {
                for (const typeExt of typeExtensions) {
                    const checkPath = resolvedTypesPath + typeExt;
                    try {
                        await fs.access(checkPath);
                        return checkPath;
                    } catch { }
                }
            } else {
                try {
                    await fs.access(resolvedTypesPath);
                    return resolvedTypesPath;
                } catch { }
            }
        }
    } catch (error) {
        return null;
    }

    return null; // No type definition found
}

/**
 * Removes comments (both single-line and multi-line) from the given code.
 */
function removeComments(code: string): string {
    code = code.replace(/\/\/.*$/gm, ''); // Remove single-line comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
    return code;
}

/**
 * Adds indentation to each line of the given code.
 */
function indentCode(code: string, level: number = 0): string {
    const indent = '  '.repeat(level);
    return code.split('\n').map(line => indent + line).join('\n');
}

/**
 * Reads and extracts relevant compiler options from tsconfig.json.
 */
async function getTsConfigContext(currentDir: string): Promise<string> {
    const tsConfigPath = path.resolve(currentDir, 'tsconfig.json');
    try {
        const tsConfigContent = await fs.readFile(tsConfigPath, 'utf-8');
        const tsConfig = JSON.parse(tsConfigContent);
        const relevantOptions = {
            compilerOptions: {
                target: tsConfig.compilerOptions?.target,
                module: tsConfig.compilerOptions?.module,
                moduleResolution: tsConfig.compilerOptions?.moduleResolution,
                baseUrl: tsConfig.compilerOptions?.baseUrl,
                paths: tsConfig.compilerOptions?.paths,
                esModuleInterop: tsConfig.compilerOptions?.esModuleInterop,
                strict: tsConfig.compilerOptions?.strict,
                jsx: tsConfig.compilerOptions?.jsx,
                lib: tsConfig.compilerOptions?.lib,
            },
            include: tsConfig.include,
            exclude: tsConfig.exclude,
        };
        return `/* --- TSCONFIG.JSON CONTEXT --- */\n${indentCode(JSON.stringify(relevantOptions, null, 2))}\n/* --- END TSCONFIG.JSON CONTEXT --- */\n\n`;
    } catch (error) {
        return `/* --- TSCONFIG.JSON CONTEXT: NOT FOUND OR ERROR READING --- */\n`;
    }
}

/**
 * Gets the main entry points from tsconfig.json's "include" field.
 * Handles globs and expands them to concrete file paths.
 */
async function getEntryPoints(currentDir: string): Promise<string[]> {
    const tsConfigPath = path.resolve(currentDir, 'tsconfig.json');
    try {
        const tsConfigContent = await fs.readFile(tsConfigPath, 'utf-8');
        const tsConfig = JSON.parse(tsConfigContent);
        const includeGlobs = tsConfig.include;

        if (!includeGlobs || !Array.isArray(includeGlobs)) {
            return [];
        }

        const entryPoints: string[] = [];
        for (const globPattern of includeGlobs) {
            const expandedPaths = await expandGlob(globPattern, currentDir);
            entryPoints.push(...expandedPaths);
        }

        // Deduplicate entry points
        return [...new Set(entryPoints)];

    } catch (error) {
        console.error("Error reading or parsing tsconfig.json:", error);
        return [];
    }
}

/**
 * Expands a glob pattern to a list of file paths.  Uses the TypeScript compiler API.
 */
async function expandGlob(globPattern: string, currentDir: string): Promise<string[]> {
    const compilerOptions: ts.CompilerOptions = {
        allowJs: true, // Allow processing of JS files
        // Add other necessary compiler options here, if needed
    };
    const host = ts.sys; // Use the TypeScript system host

    const results = ts.parseJsonConfigFileContent(
        { include: [globPattern] }, // Minimal config for glob expansion
        host,
        currentDir,
        compilerOptions
    );
    return results.fileNames;
}

/**
 * Processes a single file, including its imports and type definitions.
 */
async function processFile(filePath: string, currentDir: string, visited: Set<string>, depth: number, maxDepth: number, removeCommentsFlag: boolean, isEntryPoint: boolean = false): Promise<string> {
    if (depth > maxDepth) {
        return '';
    }

    const resolvedPath = await resolveFile(filePath, currentDir);
    if (!resolvedPath) {
        console.error(`Error: File not found: ${filePath}`);
        return `/* Error: File not found: ${filePath} */\n`;
    }

    if (visited.has(resolvedPath)) {
        return `/* Already included: ${resolvedPath} */\n`;
    }
    visited.add(resolvedPath);

    let fileContent = await fs.readFile(resolvedPath, 'utf-8');

    if (removeCommentsFlag) {
        fileContent = removeComments(fileContent);
    }

    let fileHeader = `/* --- START FILE: ${resolvedPath} (Type: ${path.extname(resolvedPath)})`;
    if (isEntryPoint) {
        fileHeader += ` (Entry Point)`;
    }
    fileHeader += ` --- */\n`;

    let result = fileHeader;
    result += `/* --- IMPORTS --- */\n`;

    const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    let importPromises: Promise<string>[] = [];

    while ((match = importRegex.exec(fileContent)) !== null) {
        const importPath = match[1];

        if (importPath.startsWith('.') || importPath.startsWith('/')) {
            // Local dependency
            importPromises.push(processFile(importPath, path.dirname(resolvedPath), visited, depth + 1, maxDepth, removeCommentsFlag));
        } else {
            // External module - try to find type definitions
            const typeDefPath = await resolveTypeDefinition(importPath, path.dirname(resolvedPath));
            if (typeDefPath) {
                try {
                    let typeDefContent = await fs.readFile(typeDefPath, 'utf-8');
                    if (removeCommentsFlag) {
                        typeDefContent = removeComments(typeDefContent);
                    }
                    result += `/* --- START TYPE DEFINITIONS: ${importPath} (from ${typeDefPath}) --- */\n`;
                    result += indentCode(typeDefContent, 1); // Indent type definitions
                    result += `\n/* --- END TYPE DEFINITIONS: ${importPath} --- */\n\n`;
                } catch (err) {
                    console.error(`Error reading type definition file ${typeDefPath}:`, err);
                    result += `/* Error reading type definition file: ${typeDefPath} */\n`;
                }
            } else {
                result += `/* --- NO TYPE DEFINITIONS FOUND FOR: ${importPath} --- */\n`;
            }
        }
    }

    const importedContents = await Promise.all(importPromises);
    result += importedContents.join('');
    result = result.replace(/;+$/, ''); // Remove trailing semicolons

    result += `/* --- END IMPORTS --- */\n`
    result += `/* --- CODE --- */\n`;
     // Remove import statements from the main code section
    let codeWithoutImports = fileContent.replace(importRegex, '');
    codeWithoutImports = codeWithoutImports.replace(/^\s*;+/, ''); // Remove leading semicolons.
    result += indentCode(codeWithoutImports);
    result += `\n/* --- END FILE: ${resolvedPath} --- */\n\n`;

    return result;
}

/**
 * Collects TypeScript errors and the files that contain them.
 */
async function collectErrorsAndFiles(tsconfigPath: string): Promise<{ errors: string[], files: string[] }> {
    const configFileName = path.resolve(tsconfigPath);
    const configFile = ts.readConfigFile(configFileName, ts.sys.readFile);

    if (configFile.error) {
        return { errors: [ts.flattenDiagnosticMessageText(configFile.error.messageText, ts.sys.newLine)], files: [] };
    }

    const parsedCommandLine = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configFileName)
    );

    if (parsedCommandLine.errors.length > 0) {
        const formattedErrors = parsedCommandLine.errors.map(diagnostic =>
            ts.formatDiagnostic(diagnostic, {
                getCanonicalFileName: path => path,
                getCurrentDirectory: ts.sys.getCurrentDirectory,
                getNewLine: () => ts.sys.newLine,
            }));
        return { errors: formattedErrors, files: [] };
    }

    const program = ts.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options);
    const allDiagnostics = ts.getPreEmitDiagnostics(program);

    const formatHost: ts.FormatDiagnosticsHost = {
        getCanonicalFileName: path => path,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => ts.sys.newLine,
    };

    const errors: string[] = [];
    const files: Set<string> = new Set();

    allDiagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
            const filePath = path.normalize(diagnostic.file.fileName);
            files.add(filePath);
        }
        errors.push(ts.formatDiagnostic(diagnostic, formatHost));
    });

    return { errors, files: Array.from(files) };
}

/**
 * Main function to process files based on command-line arguments.
 */
async function main() {
    let inputFile = ''; //  Used to exclude the tool itself
    let outputFile = '';
    let maxDepth = Infinity;
    let removeCommentsFlag = false;
    let checkMode = false;

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        switch (arg) {
            case '-o':
                outputFile = process.argv[i + 1];
                i++;
                break;
            case '-d':
                const depthValue = process.argv[i + 1];
                if (!depthValue || isNaN(parseInt(depthValue, 10)) || parseInt(depthValue, 10) < 0) {
                    console.error("Invalid depth value for -d.  Must be a non-negative integer.");
                    process.exit(1);
                }
                maxDepth = parseInt(depthValue, 10);
                i++;
                break;
            case '-c':
                checkMode = true;
                break;
            case '--remove-comments':
                removeCommentsFlag = true;
                break;
            default:
                 if (!inputFile) {
                  inputFile = arg; // Still capture for potential error message consistency
                } else {
                  console.error("Invalid arguments. Usage: context [-o output_file] [-d max_depth] [-c] [--remove-comments] [input_file]");
                  process.exit(1);
                }
        }
    }

    const currentDir = process.cwd();
    const tsconfigPath = path.resolve(currentDir, 'tsconfig.json');
    // Use import.meta.url and fileURLToPath to get __filename equivalent in ESM
    const toolFilePath = path.resolve(fileURLToPath(import.meta.url));

    if (checkMode) {
        // --- Check mode (collect errors and files) ---
        const { errors, files } = await collectErrorsAndFiles(tsconfigPath);

        if (errors.length > 0) {
            let errorOutput = "/* --- TYPESCRIPT ERRORS --- */\n";
            errors.forEach(error => errorOutput += error + "\n");
            errorOutput += "/* --- END TYPESCRIPT ERRORS --- */\n\n";

            let filesOutput = "/* --- FILES WITH ERRORS --- */\n";
            const visited: Set<string> = new Set(); // Keep track of visited files.
            for (const file of files) {
                // Recursively process each file and its imports.
                 if (file !== toolFilePath) { // Exclude the tool itself
                    filesOutput += await processFile(file, currentDir, visited, 0, Infinity, removeCommentsFlag);
                 }
            }

            filesOutput += "/* --- END FILES WITH ERRORS --- */\n";
            const finalOutput = errorOutput + filesOutput;

            if (outputFile) {
                await fs.writeFile(outputFile, finalOutput, 'utf-8');
                console.log(`Output written to ${outputFile}`);
            } else {
                console.log(finalOutput);
							}
							process.exit(1); // Exit with error code
					} else {
							console.log("No TypeScript errors found.");
							if (outputFile) {
									await fs.writeFile(outputFile, "No TypeScript errors found.", 'utf-8');
							}
							process.exit(0);
					}
	
			} else {
					// --- Bundling behavior (now processes all entry points) ---
					const visited = new Set<string>();
					let bundledCode = await getTsConfigContext(currentDir);
					const entryPoints = await getEntryPoints(currentDir);
	
	
					if (entryPoints.length === 0) {
							console.error("No entry points found in tsconfig.json's 'include' field.");
							process.exit(1);
					}
	
					// Filter out the tool itself from processing.  Crucially, compare *absolute* paths.
					const filteredEntryPoints = entryPoints.filter(entryPoint => {
							const absoluteEntryPoint = path.resolve(currentDir, entryPoint);
							return absoluteEntryPoint !== toolFilePath;
					});
	
					for (const entryPoint of filteredEntryPoints) {
							bundledCode += await processFile(entryPoint, currentDir, visited, 0, maxDepth, removeCommentsFlag, true);
					}
	
					if (outputFile) {
							try {
									await fs.writeFile(outputFile, bundledCode, 'utf-8');
									console.log(`Output written to ${outputFile}`);
							} catch (err) {
									console.error(`Error writing to output file ${outputFile}:`, err);
									process.exit(1);
							}
					} else {
							console.log(bundledCode);
					}
			}
	}
	
	main().catch(err => {
			console.error("An unexpected error occurred:", err);
			process.exit(1);
	});
	
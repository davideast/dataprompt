#!/usr/bin/env tsx
import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import { fileURLToPath } from 'url';

const extensions = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx"];
const typeExtensions = [".d.ts", ".d.mts", ".d.cts"];

// --- Utility Functions --- (Remain Unchanged)
async function resolveFile(filePath: string, currentDir: string): Promise<string | null> {
    const absolutePath = path.resolve(currentDir, filePath);
    try {
        await fs.access(absolutePath);
        return absolutePath;
    } catch { }
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
    if (ext === '') {
        for (const ext of extensions) {
            const fullPath = absolutePath + ext;
            try {
                await fs.access(fullPath);
                return fullPath;
            } catch { }
        }
    }
    for (const ext of extensions) {
        const indexPath = path.join(absolutePath, `/index${ext}`);
        try {
            await fs.access(indexPath);
            return indexPath;
        } catch { }
    }
    return null;
}

async function resolveTypeDefinition(moduleName: string, currentDir: string): Promise<string | null> {
    const typesPackagePath = path.resolve(currentDir, 'node_modules', '@types', moduleName);
    const moduleIndexPath = path.resolve(currentDir, 'node_modules', moduleName, 'index.d.ts');
    const modulePackageJson = path.resolve(currentDir, 'node_modules', moduleName, 'package.json');
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
    for (const typeExt of typeExtensions) {
        const checkPath = moduleIndexPath + typeExt
        try {
            await fs.access(checkPath)
            return checkPath;
        } catch { }
    }
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
    return null;
}

function removeComments(code: string): string {
    code = code.replace(/\/\/.*$/gm, '');
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    return code;
}

function indentCode(code: string, level: number = 0): string {
    const indent = '  '.repeat(level);
    return code.split('\n').map(line => indent + line).join('\n');
}

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
// --- Core Logic (Modified) ---

async function processFile(filePath: string, currentDir: string, visited: Set<string>, depth: number, maxDepth: number, removeCommentsFlag: boolean, isEntryPoint: boolean = false): Promise<string> {
    if (depth > maxDepth) {
        return '';
    }

    let resolvedPath = await resolveFile(filePath, currentDir);
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
            // Local dependency:  Resolve *before* taking dirname
            const resolvedImportPath = await resolveFile(importPath, path.dirname(resolvedPath));
            if (resolvedImportPath) {
                importPromises.push(processFile(resolvedImportPath, path.dirname(resolvedImportPath), visited, depth + 1, maxDepth, removeCommentsFlag));
            } else {
                result += `/* Error: Could not resolve import: ${importPath} */\n`;
            }

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
                    result += indentCode(typeDefContent, 1);
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
    result = result.replace(/;+$/, '');

    result += `/* --- END IMPORTS --- */\n`;
    result += `/* --- CODE --- */\n`;
    let codeWithoutImports = fileContent.replace(importRegex, '');
    codeWithoutImports = codeWithoutImports.replace(/^\s*;+/, '');
    result += indentCode(codeWithoutImports);
    result += `\n/* --- END FILE: ${resolvedPath} --- */\n\n`;

    return result;
}

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

async function main() {
    let inputFile = '';
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
                  inputFile = arg;
                } else {
                  console.error("Invalid arguments. Usage: context [-o output_file] [-d max_depth] [-c] [--remove-comments] [input_file]");
                  process.exit(1);
                }
        }
    }

    const currentDir = process.cwd();
    const tsconfigPath = path.resolve(currentDir, 'tsconfig.json');
    const toolFilePath = path.resolve(fileURLToPath(import.meta.url));

    if (checkMode) {
        // --- Check mode (collect errors and files) ---
        const { errors, files } = await collectErrorsAndFiles(tsconfigPath);

        if (errors.length > 0) {
            let errorOutput = "/* --- TYPESCRIPT ERRORS --- */\n";
            errors.forEach(error => errorOutput += error + "\n");
            errorOutput += "/* --- END TYPESCRIPT ERRORS --- */\n\n";

            let filesOutput = "/* --- FILES WITH ERRORS --- */\n";
            const visited: Set<string> = new Set();
            for (const file of files) {
                 if (file !== toolFilePath) {
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
            process.exit(1);
        } else {
            console.log("No TypeScript errors found.");
            if (outputFile) {
                await fs.writeFile(outputFile, "No TypeScript errors found.", 'utf-8');
            }
            process.exit(0);
        }

    } else {
        // --- Bundling behavior (Start at inputFile) ---
        const visited = new Set<string>();
        let bundledCode = await getTsConfigContext(currentDir);

        if (inputFile) {
            const resolvedInputFile = path.resolve(currentDir, inputFile);
             if (resolvedInputFile === toolFilePath) {
                console.error("Cannot use the context tool itself as the input file.");
                process.exit(1);
            }
            bundledCode += await processFile(resolvedInputFile, currentDir, visited, 0, maxDepth, removeCommentsFlag, true);
        } else {
					console.error("Missing input file. Usage: context [-o output_file] [-d max_depth] [-c] [--remove-comments] [input_file]");
					process.exit(1);
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

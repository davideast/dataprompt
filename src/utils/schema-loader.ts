import { z } from 'genkit';
import path, { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { Genkit } from 'genkit'
import { jsonSchemaToZod } from 'json-schema-to-zod';
import fs from 'node:fs/promises';
import { Schema } from 'dotprompt';
import { findUp } from 'find-up';

export interface SchemaExports {
  [key: string]: z.ZodType<any, any, any>;
}

export type SchemaMap = Map<string, z.ZodType>;

async function loadSchemaFile(filePath: string) {
  const moduleUrl = pathToFileURL(filePath).toString();
  return import(moduleUrl);
}

async function loadUserSchemas(params: {
  rootDir: string,
  schemaFile: string,
  buildDir?: string,
}): Promise<SchemaExports> {
  const { rootDir, schemaFile, buildDir: providedBuildDir } = params;
  let resolvedBuildDir = providedBuildDir;

  const isTypeScriptFile = /\.ts(x)?$|\.cts|\.mts$/.test(schemaFile);

  if (isTypeScriptFile && !providedBuildDir) {
    resolvedBuildDir = await findBuildDir(rootDir);
  }

  let compiledFilePath: string | undefined;
  if (isTypeScriptFile && resolvedBuildDir) {
    const schemaFileBase = path.basename(schemaFile).replace(/\.ts(x)?$|\.cts|\.mts$/, '');

      // Determine correct javascript file extension
    let jsExtension = '.js';
    if (schemaFile.endsWith('.cts')) {
      jsExtension = '.cjs';
    } else if (schemaFile.endsWith('.mts')) {
      jsExtension = '.mjs';
    }

    compiledFilePath = path.resolve(resolvedBuildDir, `${schemaFileBase}${jsExtension}`);
  }

  if (compiledFilePath && existsSync(compiledFilePath)) {
    try {
      const schemaModule = await loadSchemaFile(compiledFilePath);
      return extractSchemas(schemaModule);
    } catch (error) {
      console.error(`Error loading compiled schema file: ${compiledFilePath}`, error);
    }
  }

    let originalSchemaPath = path.resolve(rootDir, schemaFile);

    if (existsSync(originalSchemaPath) && !isTypeScriptFile) {
        const schemaModule = await loadSchemaFile(originalSchemaPath);
        return extractSchemas(schemaModule);
    }

  const fallbackSchemaPath = path.resolve(rootDir, 'schema.js');
  if (existsSync(fallbackSchemaPath)) {
    try{
        const schemaModule = await loadSchemaFile(fallbackSchemaPath);
        return extractSchemas(schemaModule);
    } catch (error) {
      console.error(`Error loading fallback schema file: ${fallbackSchemaPath}`, error);
    }
  }

  console.warn(`Schema file not found`);
  return {};
}

function extractSchemas(schemaModule: any): SchemaExports {
  const schemaMap: SchemaExports = {};
  for (const key in schemaModule) {
    if (Object.hasOwn(schemaModule, key)) {
      const value = schemaModule[key];
      if (isZodSchema(value)) {
        schemaMap[key] = value;
      }
    }
  }
  return schemaMap;
}


export async function registerUserSchemas(params: {
  genkit: Genkit,
  schemaFile: string,
  rootDir: string,
  buildDir?: string,
}): Promise<SchemaMap> {
  let { genkit, buildDir } = params;
  const schemas = await loadUserSchemas({...params, buildDir});
  const schemaMap = new Map<string, z.ZodType>();
  for (const [name, schema] of Object.entries(schemas)) {
    const lookup = genkit.registry.lookupSchema(name);
    if (lookup == null) {
      genkit.defineSchema(name, schema);
      schemaMap.set(name, schema);
    } else {
      if(lookup.schema) {
        schemaMap.set(name, lookup.schema)
      }
      console.warn(`Schema ${name} already registered`);
    }
  }
  return schemaMap;
}

async function findBuildDir(rootDir: string): Promise<string | undefined> {
  const tsconfigPath = await findUp('tsconfig.json', { cwd: rootDir });

  if (tsconfigPath) {
    try {
      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(tsconfigContent);

      const outDir = tsconfig.compilerOptions?.outDir;

      if (outDir) {
        return path.resolve(path.dirname(tsconfigPath), outDir);
      }
    } catch (error) {
      console.warn(`Error reading or parsing tsconfig.json: ${error}`);
      return undefined;
    }
  }

  return undefined;
}

export async function generateAndImportZodSchema(params: {
  rootDir: string,
  schema: Schema
}) {
  const code = jsonSchemaToZod(params.schema, { module: "esm", type: false });
  const tempFileName = path.resolve(params.rootDir, './.dataprompt_schemas.js');
  await fs.writeFile(tempFileName, code);
  try {
    const module = await import(tempFileName);
    return module.default;
  } finally {
    await fs.unlink(tempFileName);
  }
}

function isZodSchema(value: any): boolean {
  return value && typeof value === 'object' && value._def !== undefined;
}

// TODO(davideast): This is really a best guess for detecting 
// if the schema supplied in a dotprompt is a zod, primitive, or picoschema
export function isZodSchemaInPrompt(schema: any): boolean {
  const primitiveTypes = ['string', 'number', 'boolean', 'integer'];
  if (typeof schema === 'string') {
    // Check if the string is one of the primitive types.
    if (primitiveTypes.includes(schema.toLowerCase())) {
      return false; // It's a primitive type, not a Zod schema name.
    }
    return true; // It's a string, and *not* a primitive type, so assume Zod schema name.
  }

  if (typeof schema === 'object' && schema !== null) {
    return false; // Object indicates an inline schema (not Zod)
  }

  return false; // Other cases (e.g., missing 'output', 'schema', or an unexpected type)
}

async function resolveZodSchema(params: {
  schema: any,
  rootDir: string,
  ai: Genkit,
}): Promise<z.ZodSchema> {
  const { schema, rootDir, ai } = params;
  if (isZodSchemaInPrompt(schema)) {
    // Case 1:  It's a Zod schema name (string, not a primitive).
    const foundSchema = ai.registry.lookupSchema(schema);
    if (!foundSchema?.schema) {
      throw new Error(`Zod schema with name "${schema}" not found in registry.`);
    }
    return foundSchema.schema;
  } else if (typeof schema === 'object' && schema !== null) {
    // Case 2: It's an inline JSON schema (Picoschema).
    return await generateAndImportZodSchema({ rootDir, schema });
  } else if (typeof schema === 'string') {
    //Case 3: It's a string and a primitive
    if (schema === 'string') {
      return z.string();
    }
    if (schema === 'number') {
      return z.number();
    }
    if (schema === 'boolean') {
      return z.boolean();
    }
    if (schema === 'integer') {
      return z.number().int(); //Zod uses .int() to create an integer schema from a number
    }
    throw new Error(`Unknown primitive schema type: ${schema}`);
  }
  else {
    throw new Error(`Invalid schema definition: ${JSON.stringify(schema)}`);
  }
}

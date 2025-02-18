import { z } from 'genkit';
import path, { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { Genkit } from 'genkit'
import { jsonSchemaToZod } from 'json-schema-to-zod';
import fs from 'node:fs/promises';
import { Schema } from 'dotprompt';

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
}): Promise<SchemaExports> {
  const { rootDir, schemaFile } = params;
  let schemaPath = schemaFile;

  // only construct the path if it's not absolute
  if (!isAbsolute(schemaFile)) {
    schemaPath = join(rootDir, schemaFile);
  }

  // Try loading the schema file, and if it fails, try the fallback.
  try {
    if (existsSync(schemaPath)) {
      const schemaModule = await loadSchemaFile(schemaPath);
      return extractSchemas(schemaModule);
    } else {
      // Only try the fallback if the initial path doesn't exist.
      const fallbackSchemaPath = join(rootDir, 'schema.js');
      if (schemaPath !== fallbackSchemaPath && existsSync(fallbackSchemaPath)) {
        const schemaModule = await loadSchemaFile(fallbackSchemaPath);
        return extractSchemas(schemaModule);
      } else {
        console.warn(`Schema file not found at either ${schemaPath} or ${fallbackSchemaPath}`);
        return {};
      }
    }
  } catch (error) {
    throw new Error(`Error loading schema file: ${error}`);
  }
}

function extractSchemas(schemaModule: any): SchemaExports {
  const schemaMap: SchemaExports = {};
  for (const key in schemaModule) {
    if (Object.hasOwn(schemaModule, key)) {
      const value = schemaModule[key];
      if (value instanceof z.ZodType) {
        schemaMap[key] = value;
      }
    }
  }
  return schemaMap;
}

// TODO(davideast): Consider moving this into a manager to allow
// for dynamically loading schemas at runtime. But you actually have 
// to understand how Genkit manages schemas.
export async function registerUserSchemas(params: {
  genkit: Genkit,
  schemaFile: string,
  rootDir: string,
}): Promise<SchemaMap> {
  const { genkit } = params;
  const schemas = await loadUserSchemas(params);
  const schemaMap = new Map<string, z.ZodType>()
  for (const [name, schema] of Object.entries(schemas)) {
    if (genkit.registry.lookupSchema(name) == null) {
      genkit.defineSchema(name, schema);
      schemaMap.set(name, schema);
    } else {
      console.warn(`Schema ${name} already registered`);
    }
  }
  return schemaMap;
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

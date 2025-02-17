import { z } from 'genkit';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { Genkit } from 'genkit'

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
    if(genkit.registry.lookupSchema(name) == null) {
      genkit.defineSchema(name, schema);
      schemaMap.set(name, schema);
    } else {
      console.warn(`Schema ${name} already registered`);
    }
  }
  return schemaMap;
}

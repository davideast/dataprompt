import { z } from 'genkit';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { Genkit } from 'genkit'

export interface SchemaMap {
  [key: string]: z.ZodType<any, any, any>;
}

async function loadSchemaFile(filePath: string) {
  const moduleUrl = pathToFileURL(filePath).toString();
  return import(moduleUrl);
}

export async function loadUserSchemas(
  projectRoot: string,
  schemaFile = 'schema.js'
): Promise<SchemaMap> {

  let schemaPath = schemaFile;

  if (!isAbsolute(schemaFile)) {
    schemaPath = join(projectRoot, schemaFile);
    console.log({ schemaPath: schemaPath })
  }

  // Try loading the schema file, and if it fails, try the fallback.
  try {
    if (existsSync(schemaPath)) {
      const schemaModule = await loadSchemaFile(schemaPath);
      return extractSchemas(schemaModule);
    } else {
      // Only try the fallback if the initial path doesn't exist.
      const fallbackSchemaPath = join(projectRoot, 'schema.js');
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

function extractSchemas(schemaModule: any): SchemaMap {
  const schemaMap: SchemaMap = {};

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

export async function registerUserSchemas(ai: Genkit, schemaFile: string) {
  const schemas = await loadUserSchemas(schemaFile);
  for (const [name, schema] of Object.entries(schemas)) {
    if(ai.registry.lookupSchema(name) == null) {
      console.log(`Registering schema ${name}`);
      ai.defineSchema(name, schema);
    } else {
      console.warn(`Schema ${name} already registered`);
    }
  }
  return schemas;
}

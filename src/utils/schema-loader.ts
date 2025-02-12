import { z } from 'genkit';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import {Genkit} from 'genkit'

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
  let schemas: SchemaMap = {};

  const jsPath = join(projectRoot, 'dist', schemaFile);
  if (existsSync(jsPath)) {
    try {
      const schemaModule = await loadSchemaFile(jsPath);
      schemas = extractSchemas(schemaModule);
    } catch (error) {
      throw new Error(`Error loading compiled ${jsPath}: ${error}`);
    }
  } else {
    // Fall back to root project schema file
    const rootJsPath = join(projectRoot, schemaFile);
    if (existsSync(rootJsPath)) {
      try {
        const schemaModule = await loadSchemaFile(rootJsPath);
        schemas = extractSchemas(schemaModule);
      } catch (error) {
        throw new Error(`Error loading root ${rootJsPath}: ${error}`);
      }
    } else {
      console.warn(`Root schema.js not found.`);
    }
  }
  return schemas;
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

export async function registerUserSchemas(ai: Genkit, schemaFile = 'schema.js') {
  const schemas = await loadUserSchemas(process.cwd(), schemaFile);
  for (const [name, schema] of Object.entries(schemas)) {
    ai.defineSchema(name, schema);
  }
}

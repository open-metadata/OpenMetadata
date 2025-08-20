/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { RJSFSchema } from '@rjsf/utils';
import { cloneDeep, get } from 'lodash';

type JsonSchema = RJSFSchema & {
  $ref?: string;
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  definitions?: Record<string, JsonSchema>;
  [key: string]: unknown;
};

const schemaCache = new Map<string, JsonSchema>();

async function loadExternalSchema(refPath: string): Promise<JsonSchema> {
  if (schemaCache.has(refPath)) {
    return schemaCache.get(refPath) as JsonSchema;
  }

  try {
    // Remove the relative path prefix and .json extension
    const cleanPath = refPath
      .replace(/^\.\.\/\.\.\//, '')
      .replace(/\.json$/, '');

    // Dynamic import the schema
    const module = await import(`../../${cleanPath}.json`);
    const schema = module.default || module;

    schemaCache.set(refPath, schema);

    return schema;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to load schema: ${refPath}`, error);

    throw new Error(`Cannot resolve schema reference: ${refPath}`);
  }
}

function resolveInternalRef(
  schema: JsonSchema,
  ref: string
): JsonSchema | null {
  // Handle internal references like #/definitions/something
  if (!ref.startsWith('#/')) {
    return null;
  }

  const path = ref.substring(2).split('/');

  return get(schema, path) as JsonSchema | null;
}

async function resolveSchemaRefs(
  schema: JsonSchema | unknown,
  rootSchema: JsonSchema,
  visitedRefs: Set<string> = new Set(),
  currentPath = ''
): Promise<JsonSchema> {
  // Handle null or undefined
  if (!schema) {
    return schema as JsonSchema;
  }

  // Handle primitive types
  if (typeof schema !== 'object') {
    return schema as JsonSchema;
  }

  // Handle arrays
  if (Array.isArray(schema)) {
    const resolvedArray = await Promise.all(
      schema.map((item, index) =>
        resolveSchemaRefs(
          item,
          rootSchema,
          visitedRefs,
          `${currentPath}[${index}]`
        )
      )
    );

    return resolvedArray as unknown as JsonSchema;
  }

  const schemaObj = schema as JsonSchema;

  // Handle objects with $ref
  if (schemaObj.$ref) {
    const ref = schemaObj.$ref;

    // Prevent circular references
    if (visitedRefs.has(ref)) {
      return schemaObj;
    }
    visitedRefs.add(ref);

    let resolvedSchema: JsonSchema | null = null;

    if (ref.startsWith('#/')) {
      // Internal reference
      resolvedSchema = resolveInternalRef(rootSchema, ref);
      if (resolvedSchema) {
        // Recursively resolve the referenced schema
        resolvedSchema = await resolveSchemaRefs(
          cloneDeep(resolvedSchema),
          rootSchema,
          visitedRefs,
          currentPath
        );
      }
    } else if (ref.endsWith('.json')) {
      // External reference to another JSON file
      const externalSchema = await loadExternalSchema(ref);
      // Recursively resolve the external schema with its own context
      resolvedSchema = await resolveSchemaRefs(
        cloneDeep(externalSchema),
        externalSchema,
        new Set(),
        currentPath
      );
    }

    if (resolvedSchema) {
      // Merge any additional properties from the original schema
      const { $ref: _, ...otherProps } = schemaObj;

      return { ...resolvedSchema, ...otherProps };
    }

    return schemaObj;
  }

  // Recursively process all properties
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schemaObj)) {
    result[key] = await resolveSchemaRefs(
      value,
      rootSchema,
      visitedRefs,
      `${currentPath}.${key}`
    );
  }

  return result as JsonSchema;
}

export async function resolveJsonSchema(
  schema: JsonSchema
): Promise<JsonSchema> {
  // Clone the schema to avoid mutating the original
  const clonedSchema = cloneDeep(schema);

  // Resolve all $ref references
  return resolveSchemaRefs(clonedSchema, clonedSchema);
}

export function clearSchemaCache(): void {
  schemaCache.clear();
}

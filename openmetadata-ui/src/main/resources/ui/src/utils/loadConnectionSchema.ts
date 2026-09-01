/*
 *  Copyright 2026 Collate.
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
import { getBasePath } from './HistoryUtils';

export type ConnectionSchemaModule = Record<string, unknown>;

// The connection-schema catalog is closed at ~195 entries. Cap the in-memory
// cache well above that so every unique schema is served from memory after
// first fetch, while still bounding growth if a future migration adds churn.
const SCHEMA_CACHE_LIMIT = 256;
const schemaCache = new Map<string, Promise<ConnectionSchemaModule>>();

const rememberSchema = (
  key: string,
  value: Promise<ConnectionSchemaModule>
) => {
  if (schemaCache.size >= SCHEMA_CACHE_LIMIT) {
    const oldest = schemaCache.keys().next().value;
    if (oldest !== undefined) {
      schemaCache.delete(oldest);
    }
  }
  schemaCache.set(key, value);
};

const fetchSchema = async (
  relativePath: string
): Promise<ConnectionSchemaModule> => {
  const url = `${getBasePath()}/jsons/connectionSchemas/${relativePath}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to load connection schema ${relativePath}: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as ConnectionSchemaModule;
};

/**
 * Load a connection schema JSON at runtime from the `public/` bundle.
 *
 * Connection schemas were previously `import('../jsons/connectionSchemas/...')`
 * inside every service-utils file. Rollup emitted one lazy chunk per JSON
 * (~195 chunks, ~6.5 MB), which forced the min-chunk-size merger to walk a
 * multi-thousand-chunk candidate set on every production build. Moving the
 * JSONs under `public/jsons/connectionSchemas/` takes them out of the module
 * graph entirely; Vite copies them verbatim to `dist/`. This helper fetches
 * each on demand and caches the promise so concurrent callers dedupe.
 *
 * `relativePath` is the path under `public/jsons/connectionSchemas/`, e.g.
 * `connections/database/athenaConnection.json`.
 */
export const loadConnectionSchema = (
  relativePath: string
): Promise<ConnectionSchemaModule> => {
  const cached = schemaCache.get(relativePath);
  if (cached) {
    return cached;
  }

  const pending = fetchSchema(relativePath).catch((error) => {
    // Drop failed promises so the next caller retries the network.
    schemaCache.delete(relativePath);

    throw error;
  });
  rememberSchema(relativePath, pending);

  return pending;
};

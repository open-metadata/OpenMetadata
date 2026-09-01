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

// Test-only shim for `src/utils/loadConnectionSchema.ts`. The real
// implementation uses `fetch()` to load JSONs from `public/`, which is not
// available in the jsdom test environment. Here we load the same JSONs
// synchronously from disk via `require()` and wrap in a resolved promise so
// consumers see identical schema payloads without any network calls.

const path = require('path');

const CONNECTION_SCHEMA_DIR = path.resolve(
  __dirname,
  '../../../../public/jsons/connectionSchemas'
);

const cache = new Map();

const loadConnectionSchema = (relativePath) => {
  if (cache.has(relativePath)) {
    return cache.get(relativePath);
  }
  const fullPath = path.resolve(CONNECTION_SCHEMA_DIR, relativePath);
  let pending;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require(fullPath);
    pending = Promise.resolve(data);
  } catch (error) {
    pending = Promise.reject(
      new Error(`Failed to load connection schema ${relativePath}: ${error.message}`)
    );
  }
  cache.set(relativePath, pending);

  return pending;
};

module.exports = { loadConnectionSchema };

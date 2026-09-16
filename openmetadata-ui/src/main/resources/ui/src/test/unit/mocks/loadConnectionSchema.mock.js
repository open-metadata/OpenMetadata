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

// No module-level cache: Node's `require.cache` already dedupes the JSON
// resolution per test process, and Jest resets module state between test
// files, so adding a `Map` here would only introduce unbounded growth
// (`openmetadata-performance/no-unbounded-module-cache`) with no hit-rate
// benefit for the test harness.
const loadConnectionSchema = (relativePath) => {
  const fullPath = path.resolve(CONNECTION_SCHEMA_DIR, relativePath);
  try {
    const data = require(fullPath);

    return Promise.resolve(data);
  } catch (error) {
    return Promise.reject(
      new Error(
        `Failed to load connection schema ${relativePath}: ${error.message}`
      )
    );
  }
};

module.exports = { loadConnectionSchema };

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

// Stub for `*.assets.ts` wrapper modules that hold `import.meta.glob(...)`
// calls — Vite-only syntax ts-jest cannot parse. jest.config.js
// `moduleNameMapper` redirects every `.assets` import to this file.
//
// For most named exports we return `{}` so consumers hit their empty-map
// fallback branches. But `applicationSchemaLoaders` is the one export that
// needs real behaviour: existing tests (ApplicationsClassBase.test.ts) call
// `importSchema('RdfIndexApp')` and assert the returned schema equals the
// on-disk JSON. We satisfy them by lazily building a loader from
// `src/jsons/applicationSchemas/<name>.json` via `require()` on demand.

const path = require('path');

const APPLICATION_SCHEMA_DIR = path.resolve(
  __dirname,
  '../../..',
  'jsons/applicationSchemas'
);

const applicationSchemaLoaders = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== 'string') {
        return undefined;
      }
      const match = prop.match(/applicationSchemas\/([^/]+\.json)$/);
      if (!match) {
        return undefined;
      }
      const jsonPath = path.resolve(APPLICATION_SCHEMA_DIR, match[1]);
      try {
        const data = require(jsonPath);

        return () => Promise.resolve(data);
      } catch (error) {
        return undefined;
      }
    },
    has(_target, prop) {
      if (typeof prop !== 'string') {
        return false;
      }
      const match = prop.match(/applicationSchemas\/([^/]+\.json)$/);
      if (!match) {
        return false;
      }
      try {
        require.resolve(path.resolve(APPLICATION_SCHEMA_DIR, match[1]));

        return true;
      } catch {
        return false;
      }
    },
  }
);

const knownExports = {
  applicationSchemaLoaders,
  appLogoLoaders: {},
  appScreenshotUrls: {},
  emojiUrls: {},
};

module.exports = new Proxy(knownExports, {
  get(target, prop) {
    return prop in target ? target[prop] : {};
  },
});

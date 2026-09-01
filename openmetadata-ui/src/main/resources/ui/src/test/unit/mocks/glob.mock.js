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
// calls. `import.meta.glob` is Vite-only syntax that ts-jest cannot parse, so
// jest.config.js `moduleNameMapper` redirects every `.assets` import here.
// Every named export is looked up on this proxy and returns an empty object,
// so consumers hit their empty-map fallback branch (`if (!loader) return ...`)
// without any real asset resolution happening in tests.
module.exports = new Proxy(
  {},
  {
    get() {
      return {};
    },
  }
);

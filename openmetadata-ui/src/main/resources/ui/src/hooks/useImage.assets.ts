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

// `import.meta.glob` is a Vite-only syntax extension that ts-jest cannot
// parse ("SyntaxError: Cannot use 'import.meta' outside a module"). Isolating
// it in a `.assets.ts` wrapper lets jest.config.js redirect this module to a
// stub via `moduleNameMapper` — the parent `useImage.ts` stays parseable and
// the runtime map is preserved in Vite builds.
export const emojiUrls = import.meta.glob<string>(
  '../assets/img/emojis/*.png',
  { eager: true, query: '?url', import: 'default' }
);

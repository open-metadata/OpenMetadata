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

/*
 * Jest replacement for `src/utils/isPlaywrightBuild.ts`. The real module
 * reads `import.meta.env.PW_E2E_BUILD`, which ts-jest cannot parse under
 * the default CJS transform. Wired in via `jest.config.js`'s
 * `moduleNameMapper` so every consumer sees this stub in unit tests.
 *
 * Individual tests that need to flip the flag can call
 * `jest.mock('.../isPlaywrightBuild', () => ({ isPlaywrightBuild: () => true }))`
 * from their own file — the default here is `false` so the shim paths in
 * MsalAuthenticator / Auth0Authenticator behave the same in tests as in a
 * real production bundle.
 */

export const isPlaywrightBuild = (): boolean => false;

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
 * Standalone Vite entry for `/silent-callback.html`. Runs
 * `oidc-client`'s `signinSilentCallback()` so the parent window's
 * `UserManager.signinSilent()` promise resolves. Deliberately imports
 * NOTHING else — no React, no app router, no auth context. The parent
 * tab is who owns those; the iframe just decodes the code/state pair
 * from `window.location` and posts the resulting user back over the
 * oidc-client `IFrameWindow` postMessage protocol.
 *
 * `signinSilentCallback()` still needs to look up the state that the
 * parent's `signinSilent()` wrote before opening the iframe — and the
 * parent's `UserManager` uses `oidcTokenStorage` as its `userStore` /
 * `stateStore` (see `getUserManagerConfig` in AuthProvider.util.ts).
 * `oidcTokenStorage` delegates to `swTokenStorage` (SW/IndexedDB) when
 * the service worker is available, so a default-constructed
 * `UserManager({})` in the iframe (which falls back to
 * `WebStorageStateStore` → localStorage) reads a DIFFERENT store and
 * can't find the saved state — the parent's `signinSilent()` then
 * times out. Wire the same stores here so the callback resolves.
 * Copilot review (r3901422570).
 *
 * Errors are swallowed: the iframe has no meaningful recovery available
 * on its own, and the parent window's own `signinSilent()` promise
 * times out and rejects if the postMessage never arrives.
 */

import { UserManager } from 'oidc-client';
import { oidcTokenStorage } from './utils/OidcTokenStorage';

new UserManager({ userStore: oidcTokenStorage, stateStore: oidcTokenStorage })
  .signinSilentCallback()
  .catch(() => {
    // Intentional no-op — see file header.
  });

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
 * A default-constructed `UserManager` is sufficient because the callback
 * flow does not need the app's full auth config to read `window.location`
 * or reach the parent. Errors are swallowed: the iframe has no meaningful
 * recovery available on its own, and the parent window's own
 * `signinSilent()` promise times out and rejects if the postMessage
 * never arrives.
 */

import { UserManager } from 'oidc-client';

new UserManager({}).signinSilentCallback().catch(() => {
  // Intentional no-op — see file header.
});

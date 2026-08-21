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
 * The lightweight iframe.
 *
 * This component is the standalone /silent-callback route mounted OUTSIDE the
 * AuthProvider / AppRouter tree by `index.tsx` (see the short-circuit there).
 * Its only job is to run oidc-client's `signinSilentCallback()` so the parent
 * window's `UserManager.signinSilent()` promise can resolve — no app chunks,
 * no auth context, no query client. Keeping the iframe route lightweight was
 * the parked concern from the AuthCoordinator refactor summary: the full app
 * was previously loading inside every silent-renew iframe (~MBs of JS just to
 * postMessage a token back to the parent tab), so scenario 7 of the SSO test
 * refactor asserts this route stays a tiny standalone module.
 *
 * OidcAuthenticator still owns a nested /silent-callback route under
 * <Routes>; the index.tsx short-circuit takes precedence so that route is
 * effectively dead code — kept intentionally to avoid coupling this refactor
 * with the authenticator cleanup (removed in a follow-up commit).
 */

import { UserManager } from 'oidc-client';
import { useEffect } from 'react';

const SilentCallback = () => {
  useEffect(() => {
    // A default-constructed UserManager is sufficient for `signinSilentCallback()`
    // — it does not need the full app config because it only reads the OAuth
    // code/state from `window.location` and posts the resulting user back to
    // the parent window via the oidc-client IFrameWindow protocol.
    const manager = new UserManager({});
    manager.signinSilentCallback().catch(() => {
      // Swallow — the parent window's `UserManager.signinSilent()` promise
      // rejects on its own timeout when the postMessage never arrives, and
      // there is no meaningful recovery available inside the iframe itself.
    });
  }, []);

  return <div aria-hidden="true" style={{ display: 'none' }} />;
};

export default SilentCallback;

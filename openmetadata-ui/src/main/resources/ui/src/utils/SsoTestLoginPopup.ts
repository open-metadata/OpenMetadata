/*
 *  Copyright 2025 Collate.
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

// Dedicated, prefixed storage namespace so the Test Login popup never reads or
// writes the app's real auth state (oidcTokenStorage), while remaining shareable
// between the opener and the same-origin popup so the OIDC handshake completes.
export const SSO_TEST_LOGIN_STORE_PREFIX = 'omSsoTestLogin.';

/**
 * Returns true only when the current document is the SSO "Test Login" popup
 * returning from the identity provider.
 *
 * The Test Login popup reuses the admin's CONFIGURED callback URL (so the test
 * exercises the real, registered redirect URI), so we must distinguish it from a
 * normal login landing on the same `/callback`. The discriminator is precise and
 * fails closed: it requires an opener window AND an OIDC `state` that exists in
 * the dedicated Test Login store. A real login never writes that prefixed store,
 * so a real callback is never diverted.
 */
export const isSsoTestLoginPopup = (): boolean => {
  let isTestPopup = false;
  try {
    const hasOpener =
      typeof window !== 'undefined' &&
      window.opener != null &&
      window.opener !== window;
    if (hasOpener) {
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, '')
      );
      const state =
        hashParams.get('state') ??
        new URLSearchParams(window.location.search).get('state');
      isTestPopup =
        !!state &&
        window.localStorage.getItem(SSO_TEST_LOGIN_STORE_PREFIX + state) !==
          null;
    }
  } catch {
    isTestPopup = false;
  }

  return isTestPopup;
};

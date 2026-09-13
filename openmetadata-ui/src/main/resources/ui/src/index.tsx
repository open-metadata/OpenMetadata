/*
 *  Copyright 2022 Collate.
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

import { initCoreI18n } from '@openmetadata/ui-core-components';
import React from 'react';
import { createRoot } from 'react-dom/client';
import AppRoot from './AppRoot';
import './styles/index';
import { getBasePath } from './utils/HistoryUtils';
import i18next from './utils/i18next/LocalUtil';
import { isSsoTestLoginPopup } from './utils/SsoTestLoginPopup';

// Register the library's `core` i18next namespace. `addResourceBundle` is safe
// to call before `i18next.init` resolves — the bundles queue and become live
// once init completes. Kept here (not inside LocalUtil.tsx) so the library
// import doesn't leak into files that Playwright's `--list` walks.
initCoreI18n(i18next);

// Ant Design 4 has no global motion switch — that arrived with v5's token
// system — so collapse the durations instead.
//
// This is deliberately NOT `animation: none`. rc-motion drives every Ant
// overlay off `animationend`/`transitionend`; remove the animation and the
// event never fires, so the overlay never sheds its motion classes and sits
// there inert at `pointer-events: none`. That was tried on this branch and had
// to be reverted. A 1ms duration still fires both events, just immediately,
// which is what rc-motion is waiting for.
//
// The race this closes: `toBeVisible()` on an overlay is satisfied by its first
// scaled frame, so a press begun then lands mousedown on a control and mouseup
// where that control has since moved to, and the browser never synthesises a
// click. Six separate CI failures on this branch were that one mechanism.
const collapsePlaywrightMotion = () => {
  if (!import.meta.env.PW_E2E_BUILD) {
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-testid', 'playwright-motion-collapse');
  style.textContent = `*, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 1ms !important;
    transition-delay: 0s !important;
    transition-duration: 1ms !important;
  }`;
  document.head.append(style);
};

const recordPlaywrightAppBoot = () => {
  if (!import.meta.env.PW_E2E_BUILD) {
    return;
  }

  const scenarioKey = 'playwright-ui-scenario';
  const isNewScenario = !sessionStorage.getItem(scenarioKey);
  if (isNewScenario) {
    sessionStorage.setItem(scenarioKey, '1');
  }

  const basePath = getBasePath();
  const diagnostics = new URLSearchParams({ 'playwright-app-boot': '1' });
  if (isNewScenario) {
    diagnostics.set('playwright-ui-scenario', '1');
  }
  void fetch(`${basePath}/favicon.ico?${diagnostics}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => {
    if (isNewScenario) {
      sessionStorage.removeItem(scenarioKey);
    }
  });
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find the root element');
}

collapsePlaywrightMotion();
recordPlaywrightAppBoot();

// The SSO "Test Login" popup returns to the configured callback URL. When this
// document is that isolated popup, handle the OIDC handshake separately and
// NEVER mount the app, so the test can't touch the admin's real session. A real
// login on the same callback URL is not diverted (see isSsoTestLoginPopup).
if (isSsoTestLoginPopup()) {
  import('./components/SettingsSso/SsoTestLogin/ssoTestCallbackBootstrap')
    .then((module) => module.runSsoTestCallback())
    // If the chunk fails to load, close the popup so the opener doesn't hang.
    .catch(() => globalThis.close());
} else {
  const root = createRoot(container);

  root.render(
    <React.StrictMode>
      <AppRoot />
    </React.StrictMode>
  );
}

// In dev (Vite) the asset-caching service worker only serves stale chunks and
// fights HMR, so skip registration and proactively unregister any SW left over
// from a previous production session.
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        registrations.forEach((registration) => registration.unregister())
      );
  }
} else if ('serviceWorker' in navigator && 'indexedDB' in globalThis) {
  window.addEventListener('load', () => {
    const basePath = getBasePath();
    const serviceWorkerPath = basePath
      ? `${basePath}/app-worker.js`
      : '/app-worker.js';
    navigator.serviceWorker.register(serviceWorkerPath);
  });
}

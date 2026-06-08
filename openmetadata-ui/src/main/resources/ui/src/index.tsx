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

import React from 'react';
import { createRoot } from 'react-dom/client';
import AppRoot from './AppRoot';
import './styles/index';
import { getBasePath } from './utils/HistoryUtils';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find the root element');
}

// The SSO "Test Login" popup lands here. Handle the OIDC handshake in isolation
// and NEVER mount the app, so the test can't touch the admin's real session.
if (window.location.pathname.endsWith('/sso-test-callback')) {
  import('./components/SettingsSso/SsoTestLogin/ssoTestCallbackBootstrap').then(
    (module) => module.runSsoTestCallback()
  );
} else {
  const root = createRoot(container);

  root.render(
    <React.StrictMode>
      <AppRoot />
    </React.StrictMode>
  );
}

if ('serviceWorker' in navigator && 'indexedDB' in globalThis) {
  window.addEventListener('load', () => {
    const basePath = getBasePath();
    const serviceWorkerPath = basePath
      ? `${basePath}/app-worker.js`
      : '/app-worker.js';
    navigator.serviceWorker.register(serviceWorkerPath);
  });
}

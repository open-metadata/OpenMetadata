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

// Same-origin default. Downstream distributions (e.g. CDN-served bundles where
// the UI and API run on different hosts) swap this module at build time via a
// Vite resolver alias — see collate-ui's `vite.config.cdn.ts`.
import { getBasePath } from '../utils/HistoryUtils';

export function getApiBaseUrl(): string {
  return `${getBasePath()}/api/v1`;
}

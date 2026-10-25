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

import { ROUTES } from '../../../../constants/constants';

/**
 * Classic-only page trees. Settings live in the settings modal in AI mode, so
 * these must not render inside the shell — not from the classic route table
 * and not from a plugin's catch-all fallback, which both sit at `/*` and so
 * lose to these more specific splats. Links reach the modal through
 * `getSettingsLink`. ADR:2026-10-21-settings-pages-are-classic-only
 */
export const CLASSIC_ONLY_ROUTE_PATHS = [
  `${ROUTES.SETTINGS}/*`,
  `${ROUTES.MARKETPLACE}/*`,
  '/bots/*',
];

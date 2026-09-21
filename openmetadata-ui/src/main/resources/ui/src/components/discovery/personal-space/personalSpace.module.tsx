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

import React from 'react';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { AppModule } from '../../platform/ai-shell/AppModule.types';
import { RoutePosition } from '../../Settings/Applications/plugins/AppPlugin';
import { PERSONAL_SPACE_ROUTES } from './personalSpace.constants';

const PersonalSpaceGate = withSuspenseFallback(
  React.lazy(() => import('./PersonalSpaceGate/PersonalSpaceGate'))
);

const InboxPage = withSuspenseFallback(
  React.lazy(() => import('./InboxPage/InboxPage'))
);

const MyData = withSuspenseFallback(
  React.lazy(() => import('./MyData/MyData'))
);

const InboxContent = withSuspenseFallback(
  React.lazy(() => import('./InboxPage/InboxContent'))
);

const gatedInbox = (
  <PersonalSpaceGate>
    <InboxPage myDataContent={<MyData />} triageContent={<InboxContent />} />
  </PersonalSpaceGate>
);

/**
 * Personal-space app-mode module (Inbox + My Data).
 *
 * Icon-less: the Inbox surface is reached from a header entry point (not a
 * top-level sidebar item), so the sidebar derivation skips this module — but
 * its routes still flatten into the app-mode route table. `/inbox` and its
 * `activity` / `tasks` sub-tabs plus `/my-data` all render the shared
 * {@link InboxPage} shell behind the {@link PersonalSpaceGate} view-permission
 * gate; the active tab is derived from the path.
 *
 * The Inbox is a single tabbed page, so it is registered as ONE `/inbox/*`
 * route rather than one route per sub-tab. Separate per-tab routes would each
 * become their own keep-alive cache entry, leaving multiple `InboxContent`
 * instances mounted at once — and because the tab is derived from the global
 * pathname, every mounted instance would render the *same* (current) tab,
 * duplicating tab test-ids. The splat is intentionally non-cacheable (one live
 * instance), which is the correct trade-off for a tabbed page.
 */
export const personalSpaceModule: AppModule = {
  id: 'personal-space',
  navOrder: 90,
  labelKey: 'label.inbox',
  prefix: PERSONAL_SPACE_ROUTES.INBOX,
  additionalPrefixes: [PERSONAL_SPACE_ROUTES.MY_DATA],
  defaultPath: PERSONAL_SPACE_ROUTES.INBOX,
  routes: [
    {
      path: `${PERSONAL_SPACE_ROUTES.INBOX}/*`,
      element: gatedInbox,
      position: RoutePosition.APP,
    },
    {
      path: PERSONAL_SPACE_ROUTES.MY_DATA,
      element: gatedInbox,
      position: RoutePosition.APP,
    },
  ],
};

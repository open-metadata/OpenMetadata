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

import { settingsPathToHash } from './settingsPathToHash';

describe('settingsPathToHash', () => {
  it.each([
    ['/settings', 'profile'],
    ['/settings/bots', 'bots'],
    ['/bots/ingestion-bot', 'bots/ingestion-bot'],
    ['/create-user/bot', 'bots/add'],
    ['/create-user', 'members/users/create'],
    ['/settings/apps', 'applications'],
    ['/settings/apps/Data%20Insights', 'applications/Data%20Insights'],
    ['/marketplace', 'applications/marketplace'],
    [
      '/marketplace/apps/SearchIndexing',
      'applications/marketplace/SearchIndexing',
    ],
    [
      '/marketplace/apps/SearchIndexing/install',
      'applications/marketplace/SearchIndexing/install',
    ],
    ['/settings/billing', 'billing'],
    ['/settings/billing/credits', 'billing/credits'],
    ['/settings/persona/data%20steward', 'personas/data steward'],
    ['/settings/members', 'members'],
    ['/settings/members/users', 'members/users'],
    ['/settings/members/online-users', 'members/online-users'],
    ['/settings/members/teams/Org%2FA', 'members/teams/Org%2FA'],
    ['/settings/access', 'access-control'],
    ['/settings/access/roles', 'access-control/roles'],
    ['/settings/access/roles/add-role', 'access-control/roles/add'],
    ['/settings/access/policies/add-policy', 'access-control/policies/add'],
    ['/settings/access/roles/DataSteward', 'access-control/roles/DataSteward'],
    [
      '/settings/access/policies/OrgPolicy/add-rule',
      'access-control/policies/OrgPolicy/rules/add',
    ],
    [
      '/settings/access/policies/OrgPolicy/edit-rule/my%20rule',
      'access-control/policies/OrgPolicy/rules/my%20rule/edit',
    ],
    ['/settings/access/audit-logs', 'access-control/audit-logs'],
    ['/settings/notifications', 'notification'],
    ['/settings/notifications/alerts/a1/config', 'notification/alerts/a1'],
    ['/settings/notifications/add-notification', 'notification/alerts/add'],
    [
      '/settings/notifications/edit-notification/a1',
      'notification/alerts/edit/a1',
    ],
    [
      '/settings/notifications/announcements/edit/id1',
      'notification/section/announcements/edit/id1',
    ],
    ['/settings/customProperties/tables', 'custom-properties'],
    ['/settings/governance/intake-forms', 'governance/intake-forms'],
    ['/settings/preferences', 'platform-settings'],
    ['/settings/preferences/appearance', 'platform-settings/theme'],
    [
      '/settings/preferences/search-settings/tables',
      'platform-settings/search',
    ],
    ['/settings/sso', 'sso'],
  ])('maps %s to #%s', (path, hash) => {
    expect(settingsPathToHash(path)).toBe(hash);
  });

  it.each([
    '/settings/services/databases',
    '/settings/governance/workflow-definitions',
    '/settings/preferences/unknown',
    '/settings/OpenMetadata/email/edit-email-configuration',
    '/settings/billing/plans',
    '/settings/members/unknown',
    '/settings/access/unknown',
    '/settings/constructor',
    '/constructor',
    '/my-data',
    '/explore/tables',
    '/',
  ])('leaves %s as a page', (path) => {
    expect(settingsPathToHash(path)).toBeUndefined();
  });
});

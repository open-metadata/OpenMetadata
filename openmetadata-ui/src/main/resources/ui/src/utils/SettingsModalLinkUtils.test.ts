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

import { hashSubPathToView as accessHashToView } from '../components/discovery/personal-space/Profile/tabs/access-control/AccessControl.utils';
import { hashSubPathToView as appsHashToView } from '../components/discovery/personal-space/Profile/tabs/applications/Applications.utils';
import { hashSubPathToView as membersHashToView } from '../components/discovery/personal-space/Profile/tabs/members/Members.utils';
import { hashSubPathToView as notificationHashToView } from '../components/discovery/personal-space/Profile/tabs/notification/Notification.utils';
import { PLATFORM_SETTINGS_PAGES } from '../components/discovery/personal-space/Profile/tabs/platform-settings/PlatformSettings.constants';
import { hashSubPathToView as platformHashToView } from '../components/discovery/personal-space/Profile/tabs/platform-settings/PlatformSettings.utils';
import { AI_APP_MODE, DEFAULT_APP_MODE } from '../constants/appMode.constants';
import { useAppModeStore } from '../hooks/useAppMode';
import { registerAppModeSessionPredicate } from './appModeSession';
import {
  getEditPolicyRulePath,
  getNotificationAlertDetailsPath,
  getSettingPath,
  getTeamsWithFqnPath,
} from './RouterUtils';
import { getSettingsLink, settingsPathToHash } from './SettingsModalLinkUtils';

const mockIsDev = jest.fn().mockReturnValue(false);

jest.mock('./EnvironmentUtils', () => ({
  isDev: () => mockIsDev(),
}));

jest.mock('./GlobalSettingsClassBase', () => ({
  __esModule: true,
  default: { getGlobalSettingsMenuWithPermission: jest.fn(() => []) },
}));

describe('settingsPathToHash', () => {
  it.each([
    ['/settings', 'profile'],
    ['/settings/bots', 'bots'],
    ['/bots/ingestion-bot', 'bots/ingestion-bot'],
    ['/create-user/bot', 'bots/add'],
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
    ['/settings/billing/plans', 'billing/plans'],
    ['/settings/persona', 'personas'],
    ['/settings/persona/data%20steward', 'personas/data steward'],
    ['/settings/members', 'members'],
    ['/settings/members/users', 'members/users'],
    ['/settings/members/admins', 'members/admins'],
    ['/settings/members/online-users', 'members/online-users'],
    ['/settings/members/teams', 'members/teams'],
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
    [
      '/settings/access/permission-debugger',
      'access-control/permission-debugger',
    ],
    ['/settings/notifications', 'notification'],
    ['/settings/notifications/alerts', 'notification/alerts'],
    [
      '/settings/notifications/alerts/my%20alert/configuration',
      'notification/alerts/my alert',
    ],
    ['/settings/notifications/add-notification', 'notification/alerts/add'],
    [
      '/settings/notifications/edit-notification/a1',
      'notification/alerts/edit/a1',
    ],
    [
      '/settings/notifications/announcements',
      'notification/section/announcements',
    ],
    ['/settings/customProperties', 'custom-properties'],
    ['/settings/customProperties/tables', 'custom-properties/table'],
    [
      '/settings/customProperties/storedProcedures',
      'custom-properties/storedProcedure',
    ],
    ['/settings/customProperties/unknown', 'custom-properties'],
    ['/settings/governance', 'governance'],
    ['/settings/governance/intake-forms', 'governance/intake-forms'],
    [
      '/settings/governance/glossary-term-relations',
      'governance/glossary-relations',
    ],
    ['/settings/preferences', 'platform-settings'],
    ['/settings/preferences/appearance', 'platform-settings/theme'],
    ['/settings/preferences/search-settings', 'platform-settings/search'],
    [
      '/settings/preferences/search-settings/tables',
      'platform-settings/search/tables',
    ],
    ['/settings/sso', 'sso'],
    ['/settings/members/users?page=2', 'members/users'],
  ])('maps %s to #%s', (path, hash) => {
    expect(settingsPathToHash(path)).toBe(hash);
  });

  it.each([
    '/create-user',
    '/settings/services/databases',
    '/settings/governance/workflow-definitions',
    '/settings/preferences/unknown',
    '/settings/OpenMetadata/email/edit-email-configuration',
    '/settings/members/unknown',
    '/settings/access/unknown',
    '/my-data',
    '/explore/tables',
    '/data-marketplace',
    '#bots',
    '/',
  ])('has no modal equivalent for %s', (path) => {
    expect(settingsPathToHash(path)).toBeUndefined();
  });

  // The hashes are only useful if the panel that owns the tab parses them back
  // into the intended view, so pin the round-trip against each panel's parser.
  it('produces sub-paths the panels parse into the intended view', () => {
    const subPath = (path: string) =>
      (settingsPathToHash(path) ?? '').split('/').slice(1).join('/');

    expect(
      membersHashToView(subPath('/settings/members/teams/Org%2FA'))
    ).toEqual({ type: 'team-detail', fqn: 'Org/A', name: 'Org/A' });
    expect(
      accessHashToView(
        subPath('/settings/access/policies/OrgPolicy/edit-rule/my%20rule')
      )
    ).toEqual({
      type: 'policies-rule',
      fqn: 'OrgPolicy',
      name: 'OrgPolicy',
      ruleName: 'my rule',
    });
    expect(
      appsHashToView(subPath('/marketplace/apps/Data%20Insights/install'))
    ).toEqual({ type: 'install', fqn: 'Data Insights' });
    expect(
      notificationHashToView(
        subPath('/settings/notifications/edit-notification/a1')
      )
    ).toEqual({ type: 'edit', fqn: 'a1' });
    expect(
      notificationHashToView(
        subPath('/settings/notifications/alerts/a1/configuration')
      )
    ).toEqual({ type: 'detail', fqn: 'a1', name: 'a1' });
    expect(
      platformHashToView(
        subPath('/settings/preferences/search-settings/tables'),
        PLATFORM_SETTINGS_PAGES
      )
    ).toEqual({
      type: 'page',
      page: 'search',
      isEditing: false,
      itemId: 'tables',
    });
  });
});

describe('getSettingsLink', () => {
  afterEach(() => {
    useAppModeStore.getState().setMode(DEFAULT_APP_MODE);
    registerAppModeSessionPredicate(() => false);
    mockIsDev.mockReturnValue(false);
    globalThis.history.replaceState(null, '', '/');
  });

  it('returns the classic path unchanged in classic mode', () => {
    expect(getSettingsLink('/settings/bots')).toBe('/settings/bots');
  });

  it('returns the modal hash over the current search in AI mode', () => {
    useAppModeStore.getState().setMode(AI_APP_MODE);
    globalThis.history.replaceState(null, '', '/x?a=1');

    expect(getSettingsLink('/settings/bots')).toBe('?a=1#bots');
    expect(getSettingsLink(getTeamsWithFqnPath('Org'))).toBe(
      '?a=1#members/teams/Org'
    );
    expect(getSettingsLink(getEditPolicyRulePath('OrgPolicy', 'my rule'))).toBe(
      '?a=1#access-control/policies/OrgPolicy/rules/my%20rule/edit'
    );
    expect(getSettingsLink(getNotificationAlertDetailsPath('a1'))).toBe(
      '?a=1#notification/alerts/a1'
    );
  });

  // The builders feed `pathname:` targets (PersonaDetailsCard, TeamDetailsV1,
  // UserTab, ImportTeamsPage), so they must stay paths in every mode.
  it('leaves the route builders pure paths in AI mode', () => {
    useAppModeStore.getState().setMode(AI_APP_MODE);
    globalThis.history.replaceState(null, '', '/x?a=1');

    expect(getTeamsWithFqnPath('Org')).toBe('/settings/members/teams/Org');
    expect(getSettingPath('bots')).toBe('/settings/bots');
    expect(getNotificationAlertDetailsPath('a1')).toBe(
      '/settings/notifications/alerts/a1/configuration'
    );
  });

  // Nothing memoises a link: each render or click rebuilds it, so it carries
  // the search of that moment, not the one the page had when first rendered.
  it('reads the current search on every call', () => {
    useAppModeStore.getState().setMode(AI_APP_MODE);
    globalThis.history.replaceState(null, '', '/x?a=1');

    expect(getSettingsLink('/settings/bots')).toBe('?a=1#bots');

    globalThis.history.replaceState(null, '', '/x?a=2');

    expect(getSettingsLink('/settings/bots')).toBe('?a=2#bots');
  });

  // Collate's SQL Studio link opens a team on its contributed tab.
  it('opens a team on a given tab in both modes', () => {
    const teamOnTab = getTeamsWithFqnPath('Data', { activeTab: 'sql-studio' });

    expect(getSettingsLink(teamOnTab)).toBe(
      '/settings/members/teams/Data?activeTab=sql-studio'
    );

    useAppModeStore.getState().setMode(AI_APP_MODE);

    expect(getSettingsLink(teamOnTab)).toBe(
      '#members/teams/Data?activeTab=sql-studio'
    );
    // Only a team page carries the tab; the team list has none to open.
    expect(getSettingsLink('/settings/members/teams?activeTab=x')).toBe(
      '#members/teams'
    );
  });

  it('follows an active app-mode session like AppRouter does', () => {
    registerAppModeSessionPredicate(() => true);

    expect(getSettingsLink(getSettingPath('bots'))).toBe('#bots');
  });

  it('keeps a path with no modal equivalent in AI mode', () => {
    useAppModeStore.getState().setMode(AI_APP_MODE);

    expect(getSettingsLink('/settings/services/databases')).toBe(
      '/settings/services/databases'
    );
  });

  describe('a settings path with no modal equivalent', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
      warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => warn.mockRestore());

    it('warns in development, naming the path, in AI mode only', () => {
      mockIsDev.mockReturnValue(true);
      getSettingsLink('/settings/services/databases');

      expect(warn).not.toHaveBeenCalled();

      useAppModeStore.getState().setMode(AI_APP_MODE);
      getSettingsLink('/settings/bots');

      expect(warn).not.toHaveBeenCalled();

      getSettingsLink('/settings/services/databases');

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('/settings/services/databases');
    });

    it('stays silent outside development', () => {
      useAppModeStore.getState().setMode(AI_APP_MODE);
      getSettingsLink('/settings/services/databases');

      expect(warn).not.toHaveBeenCalled();
    });
  });
});

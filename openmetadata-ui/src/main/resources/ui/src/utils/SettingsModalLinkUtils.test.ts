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

import {
  parseCustomPropertiesHash,
  viewToSubPath as customPropsViewToSubPath,
} from '../components/discovery/personal-space/Profile/panels/CustomPropertiesPanel/CustomPropertiesPanel.utils';
import {
  hashSubPathToView as accessHashToView,
  viewToSubPath as accessViewToSubPath,
} from '../components/discovery/personal-space/Profile/tabs/access-control/AccessControl.utils';
import {
  hashSubPathToView as appsHashToView,
  viewToSubPath as appsViewToSubPath,
} from '../components/discovery/personal-space/Profile/tabs/applications/Applications.utils';
import {
  hashSubPathToView as governanceHashToView,
  viewToSubPath as governanceViewToSubPath,
} from '../components/discovery/personal-space/Profile/tabs/governance/Governance.utils';
import {
  hashSubPathToView as membersHashToView,
  viewToSubPath as membersViewToSubPath,
} from '../components/discovery/personal-space/Profile/tabs/members/membersRoute.utils';
import {
  hashSubPathToView as notificationHashToView,
  viewToSubPath as notificationViewToSubPath,
} from '../components/discovery/personal-space/Profile/tabs/notification/Notification.utils';
import {
  hashSubPathToView as personasHashToView,
  viewToSubPath as personasViewToSubPath,
} from '../components/discovery/personal-space/Profile/tabs/personas/Personas.utils';
import { PLATFORM_SETTINGS_PAGES } from '../components/discovery/personal-space/Profile/tabs/platform-settings/PlatformSettings.constants';
import {
  hashSubPathToView as platformHashToView,
  viewToSubPath as platformViewToSubPath,
} from '../components/discovery/personal-space/Profile/tabs/platform-settings/PlatformSettings.utils';
import { UserPageTabs } from '../components/Settings/Users/Users.interface';
import { AI_APP_MODE, DEFAULT_APP_MODE } from '../constants/appMode.constants';
import { EntityTabs } from '../enums/entity.enum';
import type { Type } from '../generated/entity/type';
import type { CustomProperty } from '../generated/type/customProperty';
import { useAppModeStore } from '../hooks/useAppMode';
import { getAlertsFromName } from '../rest/alertsAPI';
import { getApplicationByName } from '../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../rest/applicationMarketPlaceAPI';
import axiosClient from '../rest/axiosClient';
import { getBotByName } from '../rest/botsAPI';
import { getPersonaByName } from '../rest/PersonaAPI';
import { getPolicyByName, getRoleByName } from '../rest/rolesAPIV1';
import { getTeamByName } from '../rest/teamsAPI';
import { registerAppModeSessionPredicate } from './appModeSession';
import {
  getAppInstallPath,
  getApplicationDetailsPath,
  getBotsPath,
  getEditPolicyRulePath,
  getMarketPlaceAppDetailsPath,
  getNotificationAlertDetailsPath,
  getNotificationAlertsEditPath,
  getPersonaDetailsPath,
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
  getSettingPath,
  getTeamsWithFqnPath,
  getUserPath,
} from './RouterUtils';
import { safeDecodeURIComponent } from './SettingsHashUtils';
import {
  getSettingsHashForHref,
  getSettingsLink,
  settingsPathToHash,
} from './SettingsModalLinkUtils';

const mockIsDev = jest.fn().mockReturnValue(false);

jest.mock('./EnvironmentUtils', () => ({
  isDev: () => mockIsDev(),
}));

jest.mock('../rest/axiosClient', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: {} }) },
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
    ['/settings/persona/data%20steward', 'personas/data%20steward'],
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
      'notification/alerts/my%20alert',
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

/**
 * The hash contract: every name in a hash segment is URL-encoded once by
 * whoever builds the hash and decoded once by the panel's parser, which hands
 * the original name to an API that encodes it once more for the request path.
 */
describe('settings hash name encoding', () => {
  // Spaces, `%`, `/`, `#`, `?` and a quoted dotted FQN.
  const NAMES = [
    'data engineer',
    '100% owner',
    'Org/A',
    'team#1',
    'why?',
    'svc.db."a.b"',
  ];

  const mockGet = axiosClient.get as jest.Mock;

  // What the browser does with a followed link: it percent-encodes the URL and
  // `useSettingsHash` reads the sub-path off the live `location.hash`.
  const followLink = (link: string) =>
    new URL(link, 'http://localhost/page?x=1').hash
      .slice(1)
      .split('?')[0]
      .split('/')
      .slice(1)
      .join('/');

  // The request path the API built: the name exactly once-encoded.
  const expectRequestFor = (name: string) =>
    expect(String(mockGet.mock.calls.at(-1)?.[0]).split('/name/')[1]).toBe(
      encodeURIComponent(name)
    );

  beforeEach(() => {
    useAppModeStore.getState().setMode(AI_APP_MODE);
    mockGet.mockClear();
  });

  afterEach(() => useAppModeStore.getState().setMode(DEFAULT_APP_MODE));

  describe.each(NAMES)('%s', (name) => {
    it.each([
      [
        'persona',
        getPersonaDetailsPath,
        (sub: string) => {
          const view = personasHashToView(sub);

          return view.type === 'detail' ? view.fqn : '';
        },
        (fqn: string) => getPersonaByName(fqn),
      ],
      [
        'role',
        getRoleWithFqnPath,
        (sub: string) => {
          const view = accessHashToView(sub);

          return view.type === 'roles-detail' ? view.fqn : '';
        },
        (fqn: string) => getRoleByName(fqn, ''),
      ],
      [
        'policy',
        getPolicyWithFqnPath,
        (sub: string) => {
          const view = accessHashToView(sub);

          return view.type === 'policies-detail' ? view.fqn : '';
        },
        (fqn: string) => getPolicyByName(fqn, ''),
      ],
      [
        'policy of a rule',
        (fqn: string) => getEditPolicyRulePath(fqn, fqn),
        (sub: string) => {
          const view = accessHashToView(sub);

          return view.type === 'policies-rule' && view.ruleName === name
            ? view.fqn
            : '';
        },
        (fqn: string) => getPolicyByName(fqn, ''),
      ],
      [
        'notification alert',
        getNotificationAlertDetailsPath,
        (sub: string) => {
          const view = notificationHashToView(sub);

          return view.type === 'detail' ? view.fqn : '';
        },
        (fqn: string) => getAlertsFromName(fqn),
      ],
      [
        'notification alert edit',
        getNotificationAlertsEditPath,
        (sub: string) => {
          const view = notificationHashToView(sub);

          return view.type === 'edit' ? view.fqn : '';
        },
        (fqn: string) => getAlertsFromName(fqn),
      ],
      [
        'team',
        getTeamsWithFqnPath,
        (sub: string) => {
          const view = membersHashToView(sub);

          return view.type === 'team-detail' ? view.fqn : '';
        },
        (fqn: string) => getTeamByName(fqn),
      ],
      [
        'application',
        getApplicationDetailsPath,
        (sub: string) => {
          const view = appsHashToView(sub);

          return view.type === 'detail' ? view.fqn : '';
        },
        (fqn: string) => getApplicationByName(fqn),
      ],
      [
        'marketplace app',
        getMarketPlaceAppDetailsPath,
        (sub: string) => {
          const view = appsHashToView(sub);

          return view.type === 'marketplace-detail' ? view.fqn : '';
        },
        (fqn: string) => getMarketPlaceApplicationByFqn(fqn),
      ],
      [
        'app install',
        getAppInstallPath,
        (sub: string) => {
          const view = appsHashToView(sub);

          return view.type === 'install' ? view.fqn : '';
        },
        (fqn: string) => getMarketPlaceApplicationByFqn(fqn),
      ],
      [
        'bot',
        getBotsPath,
        // BotsPanel's parser: the whole sub-path is the bot name.
        safeDecodeURIComponent,
        (fqn: string) => getBotByName(fqn),
      ],
    ])(
      'reaches the %s API with the name once-encoded',
      async (_, buildPath, parse, fetch) => {
        const parsed = parse(followLink(getSettingsLink(buildPath(name))));

        expect(parsed).toBe(name);

        await fetch(parsed);

        expectRequestFor(name);
      }
    );

    // In-modal navigation (`setHash(tab, viewToSubPath(view))`) writes the
    // same encoding the panels parse.
    it('round-trips in-modal navigation through every panel parser', () => {
      const viaBrowser = (subPath = '') => followLink(`#tab/${subPath}`);
      const entityType = { fullyQualifiedName: name } as Type;
      const property = { name } as CustomProperty;

      expect(
        personasHashToView(
          viaBrowser(
            personasViewToSubPath({
              type: 'customize',
              fqn: name,
              name,
              category: 'governance/Domain',
            })
          )
        )
      ).toEqual({
        type: 'customize',
        fqn: name,
        name,
        category: 'governance/Domain',
      });
      expect(
        accessHashToView(
          viaBrowser(
            accessViewToSubPath({
              type: 'policies-rule',
              fqn: name,
              name,
              ruleName: name,
            })
          )
        )
      ).toEqual({ type: 'policies-rule', fqn: name, name, ruleName: name });
      expect(
        accessHashToView(
          viaBrowser(
            accessViewToSubPath({ type: 'roles-detail', fqn: name, name })
          )
        )
      ).toEqual({ type: 'roles-detail', fqn: name, name });
      expect(
        notificationHashToView(
          viaBrowser(notificationViewToSubPath({ type: 'edit', fqn: name }))
        )
      ).toEqual({ type: 'edit', fqn: name });
      expect(
        membersHashToView(
          viaBrowser(
            membersViewToSubPath({
              type: 'teams-import',
              fqn: name,
              importType: 'users',
            })
          )
        )
      ).toEqual({ type: 'teams-import', fqn: name, importType: 'users' });
      expect(
        appsHashToView(
          viaBrowser(appsViewToSubPath({ type: 'install', fqn: name }))
        )
      ).toEqual({ type: 'install', fqn: name });
      expect(
        governanceHashToView(
          viaBrowser(governanceViewToSubPath({ type: 'glossary-edit', name }))
        )
      ).toEqual({ type: 'glossary-edit', name });
      expect(
        parseCustomPropertiesHash(
          viaBrowser(
            customPropsViewToSubPath({ type: 'edit', entityType, property })
          )
        )
      ).toEqual({ entityFqn: name, action: 'edit', propertyName: name });
      expect(
        platformHashToView(
          viaBrowser(
            platformViewToSubPath({
              type: 'page',
              page: 'search',
              isEditing: false,
              itemId: name,
            })
          ),
          PLATFORM_SETTINGS_PAGES
        )
      ).toEqual({
        type: 'page',
        page: 'search',
        isEditing: false,
        itemId: name,
      });
    });
  });

  it('keeps a malformed escape instead of crashing the panel', () => {
    expect(personasHashToView('100%ZZ')).toEqual({
      type: 'detail',
      fqn: '100%ZZ',
      name: '100%ZZ',
    });
  });
});

describe('user page links', () => {
  afterEach(() => {
    useAppModeStore.getState().setMode(DEFAULT_APP_MODE);
    globalThis.history.replaceState(null, '', '/');
  });

  it('keeps the classic user page in classic mode', () => {
    expect(getSettingsLink(getUserPath('alice', UserPageTabs.TASK))).toBe(
      '/users/alice/task'
    );
  });

  it.each([
    [undefined, 'members/user/alice'],
    [EntityTabs.ACTIVITY_FEED, 'members/user/alice/activity'],
    [UserPageTabs.TASK, 'members/user/alice/tasks'],
    [UserPageTabs.MY_DATA, 'members/user/alice/owned-assets'],
    [UserPageTabs.FOLLOWING, 'members/user/alice/following'],
    [UserPageTabs.PERMISSIONS, 'members/user/alice/access'],
    [UserPageTabs.CUSTOM_PROPERTIES, 'members/user/alice/custom-properties'],
    [UserPageTabs.ACCESS_TOKEN, 'members/user/alice'],
  ])('opens the %s tab as #%s in AI mode', (tab, hash) => {
    useAppModeStore.getState().setMode(AI_APP_MODE);
    globalThis.history.replaceState(null, '', '/x?a=1');

    expect(getSettingsLink(getUserPath('alice', tab))).toBe(`?a=1#${hash}`);
  });

  it.each(['john.doe', 'a b', '100%', 'x/y', 'why?', 'u#1'])(
    'opens the Members user detail for %s',
    (name) => {
      useAppModeStore.getState().setMode(AI_APP_MODE);
      const hash = new URL(
        getSettingsLink(getUserPath(name, UserPageTabs.TASK)),
        'http://localhost/page'
      ).hash.slice(1);

      expect(membersHashToView(hash.split('/').slice(1).join('/'))).toEqual({
        type: 'user-detail',
        name,
        tab: 'tasks',
      });
    }
  );
});

describe('getSettingsHashForHref', () => {
  const { origin } = globalThis.location;

  afterEach(() => useAppModeStore.getState().setMode(DEFAULT_APP_MODE));

  it('maps a stored mention URL to the modal hash in AI mode', () => {
    useAppModeStore.getState().setMode(AI_APP_MODE);

    expect(getSettingsHashForHref(`${origin}/users/alice`)).toBe(
      'members/user/alice'
    );
    expect(
      getSettingsHashForHref(`${origin}/settings/members/teams/PW%25team`)
    ).toBe('members/teams/PW%25team');
  });

  it.each([
    'https://example.com/users/alice',
    `${globalThis.location.origin}/table/svc.db.schema.orders`,
  ])('leaves %s alone', (href) => {
    useAppModeStore.getState().setMode(AI_APP_MODE);

    expect(getSettingsHashForHref(href)).toBeUndefined();
  });

  // On a classic `/users/alice` page served in the AI shell, a link that is
  // already a modal hash must not be remapped to Alice.
  it.each(['?a=1#members/user/bob', '#members/teams/Eng', '?page=2', '#top'])(
    'leaves the same-page link %s alone on a user page',
    (href) => {
      useAppModeStore.getState().setMode(AI_APP_MODE);
      globalThis.history.replaceState(null, '', '/users/alice');

      expect(getSettingsHashForHref(href)).toBeUndefined();
      expect(
        getSettingsHashForHref(`${origin}/users/alice#members/user/bob`)
      ).toBeUndefined();

      globalThis.history.replaceState(null, '', '/');
    }
  );

  it('leaves every link alone in classic mode', () => {
    expect(getSettingsHashForHref(`${origin}/users/alice`)).toBeUndefined();
  });
});

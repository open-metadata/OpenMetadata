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

import { viewToSubPath as appsViewToSubPath } from '../components/discovery/personal-space/Profile/tabs/applications/Applications.utils';
import { viewToSubPath as governanceViewToSubPath } from '../components/discovery/personal-space/Profile/tabs/governance/Governance.utils';
import type { UserDetailTab } from '../components/discovery/personal-space/Profile/tabs/members/Members.types';
import { viewToSubPath as membersViewToSubPath } from '../components/discovery/personal-space/Profile/tabs/members/membersRoute.utils';
import { viewToSubPath as personasViewToSubPath } from '../components/discovery/personal-space/Profile/tabs/personas/Personas.utils';
import { UserPageTabs } from '../components/Settings/Users/Users.interface';
import { AI_APP_MODE } from '../constants/appMode.constants';
import { ENTITY_PATH } from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import { useAppModeStore } from '../hooks/useAppMode';
import { isAppModeSessionActive } from './appModeSession';
import { isDev } from './EnvironmentUtils';
import { safeDecodeURIComponent as decode } from './SettingsHashUtils';

/**
 * In AI mode the classic `/settings/*`, `/marketplace*`, `/bots/*` and
 * `/users/*` pages are not served; their content lives in the settings modal, opened by a
 * `#<tab>[/<subPath>]` hash over the current page (`useSettingsHash`). This maps
 * a classic path to that hash. Every name in a hash segment is URL-encoded
 * exactly once and each panel's parser decodes it once
 * (`safeDecodeURIComponent`). Path FQN segments arrive URL-encoded
 * (`getEncodedFqn`), so they are decoded and handed to the panel's own
 * `viewToSubPath`, or re-encoded with `reencode` where the sub-path is spelled
 * out here. Access-control, notification, bots and platform-settings sub-paths
 * are spelled out because importing their panel utils would make the route
 * builders import themselves (access control links back to them) or pull in
 * the settings menu and auth modules; the tests pin them against the panels'
 * parsers.
 * ADR:2026-10-21-settings-pages-are-classic-only
 */
type HashMapper = (
  rest: string[],
  query: URLSearchParams
) => string | undefined;

// Normalise a URL-encoded path segment to the single encoding hashes carry.
const reencode = (segment: string) => encodeURIComponent(decode(segment));

const withSub = (tab: string, subPath?: string) =>
  subPath ? `${tab}/${subPath}` : tab;

const lookup = <T>(table: Record<string, T>, key: string) =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

const {
  TEAMS,
  USERS,
  ADMINS,
  ONLINE_USERS,
  ROLES,
  POLICIES,
  PERMISSION_DEBUGGER,
  AUDIT_LOGS,
  ALERTS,
  ADD_NOTIFICATION,
  EDIT_NOTIFICATION,
  SEARCH_SETTINGS,
} = GlobalSettingOptions;
const MEMBER_LISTS: string[] = [USERS, ADMINS, ONLINE_USERS];

// Classic preferences option → platform-settings page id.
const PREFERENCE_PAGES: Record<string, string> = {
  [GlobalSettingOptions.GLOSSARY]: 'glossary',
  [GlobalSettingOptions.APPEARANCE]: 'theme',
  [GlobalSettingOptions.EMAIL]: 'email',
  [GlobalSettingOptions.LOGIN_CONFIGURATION]: 'login-configuration',
  [GlobalSettingOptions.OM_HEALTH]: 'health-check',
  [GlobalSettingOptions.PROFILER_CONFIGURATION]: 'profiler-configuration',
  [GlobalSettingOptions.DATA_QUALITY]: 'data-quality',
  [GlobalSettingOptions.LINEAGE_CONFIG]: 'lineage',
  [SEARCH_SETTINGS]: 'search',
  [GlobalSettingOptions.OM_URL_CONFIG]: 'brand-url',
  [GlobalSettingOptions.DATA_ASSET_RULES]: 'data-asset-rules',
  [GlobalSettingOptions.LEARNING_RESOURCES]: 'learning-resources',
  [GlobalSettingOptions.APP_MODE]: 'app-mode',
  [GlobalSettingOptions.TIME_FORMAT]: 'time-format',
};

const GOVERNANCE_PAGES: Record<string, string | undefined> = {
  [GlobalSettingOptions.GLOSSARY_TERM_RELATIONS]: governanceViewToSubPath({
    type: 'glossary-list',
  }),
  [GlobalSettingOptions.INTAKE_FORMS]: governanceViewToSubPath({
    type: 'intake-list',
  }),
};

// Classic user-page tab → the user-detail tab the `#profile/<name>` view opens.
// Unlisted tabs (access token) open the overview.
const USER_PAGE_TABS: Record<string, UserDetailTab> = {
  [UserPageTabs.ACTIVITY]: 'activity',
  [UserPageTabs.TASK]: 'tasks',
  [UserPageTabs.MY_DATA]: 'owned-assets',
  [UserPageTabs.FOLLOWING]: 'following',
  [UserPageTabs.PERMISSIONS]: 'access',
  [UserPageTabs.CUSTOM_PROPERTIES]: 'custom-properties',
};

// A user opens in the Members user detail, as from the Members list. A viewer
// who may not browse users there is sent on to the read-only `#profile/<name>`
// by the Profile page, which holds the permissions.
// `/users/password/reset` and `/users/registrationConfirmation` are auth pages.
const AUTH_USER_PATHS = new Set(['password', 'registrationConfirmation']);

const mapUser: HashMapper = ([name, tab]) =>
  name && !AUTH_USER_PATHS.has(name)
    ? `members/${membersViewToSubPath({
        type: 'user-detail',
        name: decode(name),
        tab: (tab && lookup(USER_PAGE_TABS, tab)) || 'overview',
      })}`
    : undefined;

// A team page's `?activeTab=<key>` becomes the hash param the team detail reads.
const withActiveTab = (hash: string, activeTab: string | null) =>
  activeTab ? `${hash}?activeTab=${encodeURIComponent(activeTab)}` : hash;

const mapMembers: HashMapper = ([option, fqn], query) => {
  if (!option) {
    return 'members';
  }
  if (option === TEAMS) {
    const name = fqn && decode(fqn);
    const hash = withSub(
      'members',
      membersViewToSubPath(
        name ? { type: 'team-detail', fqn: name, name } : { type: 'teams' }
      )
    );

    return name ? withActiveTab(hash, query.get('activeTab')) : hash;
  }

  return MEMBER_LISTS.includes(option) ? `members/${option}` : undefined;
};

// Sub-paths parsed by the Access Control panel's `hashSubPathToView`.
const toPolicySubPath = (name: string, action?: string, rule?: string) => {
  if (action === 'add-rule') {
    return `${name}/rules/add`;
  }

  return action === 'edit-rule' && rule
    ? `${name}/rules/${reencode(rule)}/edit`
    : name;
};

const mapRolesOrPolicies = (
  option: string,
  fqn?: string,
  action?: string,
  rule?: string
) => {
  if (!fqn || fqn === 'add-role' || fqn === 'add-policy') {
    return withSub(option, fqn && 'add');
  }
  const name = reencode(fqn);

  return `${option}/${
    option === ROLES ? name : toPolicySubPath(name, action, rule)
  }`;
};

const mapAccess: HashMapper = ([option, fqn, action, rule]) => {
  if (!option || option === PERMISSION_DEBUGGER || option === AUDIT_LOGS) {
    return withSub('access-control', option);
  }

  return option === ROLES || option === POLICIES
    ? `access-control/${mapRolesOrPolicies(option, fqn, action, rule)}`
    : undefined;
};

// Sub-paths parsed by the Notification panel's `hashSubPathToView`.
const mapNotifications: HashMapper = ([option, fqn, ...rest]) => {
  switch (option) {
    case undefined:
      return 'notification';
    case ALERTS:
      return withSub('notification/alerts', fqn && reencode(fqn));
    case ADD_NOTIFICATION:
      return 'notification/alerts/add';
    case EDIT_NOTIFICATION:
      return withSub('notification/alerts', fqn && `edit/${reencode(fqn)}`);
    default:
      // Every other option (announcements, Collate's weekly emails…) is a
      // contributed section keyed by the same id.
      return `notification/section/${[option, fqn, ...rest]
        .filter(Boolean)
        .join('/')}`;
  }
};

// Sub-paths parsed by the Platform Settings panel's `hashSubPathToView`.
const mapPreferences: HashMapper = ([option, item]) => {
  if (!option) {
    return 'platform-settings';
  }
  const page = lookup(PREFERENCE_PAGES, option);
  const itemId =
    option === SEARCH_SETTINGS && item ? reencode(item) : undefined;

  return page && `platform-settings/${withSub(page, itemId)}`;
};

const SETTINGS_HASH_MAPPERS = new Map<string, HashMapper>([
  ['', () => 'profile'],
  [GlobalSettingsMenuCategory.BOTS, () => 'bots'],
  [
    GlobalSettingsMenuCategory.APPLICATIONS,
    ([fqn]) =>
      withSub(
        'applications',
        fqn && appsViewToSubPath({ type: 'detail', fqn: decode(fqn) })
      ),
  ],
  [
    GlobalSettingsMenuCategory.PERSONA,
    ([fqn]) =>
      withSub(
        'personas',
        fqn &&
          personasViewToSubPath({
            type: 'detail',
            fqn: decode(fqn),
            name: decode(fqn),
          })
      ),
  ],
  [GlobalSettingsMenuCategory.MEMBERS, mapMembers],
  [GlobalSettingsMenuCategory.ACCESS, mapAccess],
  [GlobalSettingsMenuCategory.NOTIFICATIONS, mapNotifications],
  // Classic `<entityPath>` segment (`tables`) → Type FQN (`table`) the panel opens.
  [
    GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    ([entityPath]) =>
      withSub(
        'custom-properties',
        entityPath ? lookup(ENTITY_PATH, entityPath) : undefined
      ),
  ],
  [
    GlobalSettingsMenuCategory.GOVERNANCE,
    ([option]) => {
      const page = option ? lookup(GOVERNANCE_PAGES, option) : '';

      return page === undefined ? undefined : withSub('governance', page);
    },
  ],
  [GlobalSettingsMenuCategory.PREFERENCES, mapPreferences],
  [GlobalSettingsMenuCategory.SSO, () => 'sso'],
  // Collate-only: it owns the `/settings/billing/<page>` routes and the
  // `#billing` tab, whose page slugs match.
  ['billing', ([page]) => withSub('billing', page)],
]);

// Keys come from a URL: only call a mapper the table itself defines.
const dispatchMapper = (
  mappers: Map<string, HashMapper>,
  key: string,
  rest: string[],
  query: URLSearchParams
): string | undefined => {
  const mapper = mappers.has(key) ? mappers.get(key) : undefined;

  return typeof mapper === 'function' ? mapper(rest, query) : undefined;
};

const ROOT_HASH_MAPPERS = new Map<string, HashMapper>([
  [
    'settings',
    ([category = '', ...rest], query) =>
      dispatchMapper(SETTINGS_HASH_MAPPERS, category, rest, query),
  ],
  ['bots', ([name]) => withSub('bots', name && reencode(name))],
  ['users', mapUser],
  ['create-user', ([kind]) => (kind === 'bot' ? 'bots/add' : undefined)],
  [
    'marketplace',
    ([, fqn, action]) =>
      withSub(
        'applications',
        appsViewToSubPath(
          fqn
            ? {
                type: action === 'install' ? 'install' : 'marketplace-detail',
                fqn: decode(fqn),
              }
            : { type: 'marketplace' }
        )
      ),
  ],
]);

/**
 * Settings-modal hash (without `#`) for a classic settings path, or `undefined`
 * when the page has no modal equivalent (services, workflow definitions, edit
 * forms…).
 */
export const settingsPathToHash = (path: string): string | undefined => {
  const [pathname, search = ''] = path.split('#')[0].split('?', 2);
  const [root = '', ...rest] = pathname.split('/').filter(Boolean);

  return dispatchMapper(
    ROOT_HASH_MAPPERS,
    root,
    rest,
    new URLSearchParams(search)
  );
};

/** Same condition `AppRouter` uses to render the AI shell. */
export const isAiShell = (): boolean =>
  useAppModeStore.getState().currentMode === AI_APP_MODE ||
  isAppModeSessionActive();

/**
 * Modal hash for an href in the AI shell: a same-origin link (absolute, as rich
 * text stores mentions, or relative) to a page the settings modal hosts. A
 * same-page link (`#…`, `?…`) or one already carrying a hash, such as a
 * `getSettingsLink` result, is left alone: its path is the current page's, which
 * may itself be a classic `/users/<name>` route.
 */
export const getSettingsHashForHref = (href: string): string | undefined => {
  if (!isAiShell() || href.startsWith('#') || href.startsWith('?')) {
    return undefined;
  }
  const url = new URL(href, globalThis.location.href);

  return url.origin === globalThis.location.origin && !url.hash
    ? settingsPathToHash(url.pathname + url.search)
    : undefined;
};

/**
 * Mode-aware link to a classic settings, marketplace, bots or user page, for a
 * react-router `to`, a `navigate()` target or an `href` — never a `pathname`.
 * The route builders (`getSettingPath`, `getTeamsWithFqnPath`…) always return
 * the classic path; this is the one place it turns into a link. Classic: the
 * path, unchanged. AI: `<current search>#<tab>/<subPath>`, which keeps the
 * current page and opens the settings modal on it (`useSettingsHash` adopts
 * pushed hashes). The search is spelled out because react-router resolves a
 * bare `#hash` target with an empty search, dropping the page's query string.
 * A path with no modal equivalent is returned unchanged and lands on the AI
 * not-found page (warned in development).
 *
 * It reads the mode and the search when called, so call it at click time
 * (`onClick={() => navigate(getSettingsLink(path))}`) or during render — never
 * at module scope or inside a `useMemo`/`useCallback`, where the link would
 * keep the search and mode it was built with.
 * ADR:2026-10-21-settings-pages-are-classic-only
 */
export const getSettingsLink = (path: string): string => {
  if (!isAiShell()) {
    return path;
  }
  const hash = settingsPathToHash(path);
  if (hash === undefined && isDev()) {
    // eslint-disable-next-line no-console
    console.warn(
      `[settings link] "${path}" has no settings-modal equivalent; in AI mode it lands on not-found. Map it in settingsPathToHash.`
    );
  }

  return hash === undefined ? path : `${globalThis.location.search}#${hash}`;
};

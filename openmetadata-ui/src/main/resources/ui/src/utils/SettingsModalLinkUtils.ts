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
import {
  viewToSubPath as membersViewToSubPath,
  safeDecodeURIComponent as decode,
} from '../components/discovery/personal-space/Profile/tabs/members/Members.utils';
import { viewToSubPath as personasViewToSubPath } from '../components/discovery/personal-space/Profile/tabs/personas/Personas.utils';
import { AI_APP_MODE } from '../constants/appMode.constants';
import { ENTITY_PATH } from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import { useAppModeStore } from '../hooks/useAppMode';
import { isAppModeSessionActive } from './appModeSession';

/**
 * In AI mode the classic `/settings/*`, `/marketplace*` and `/bots/*` pages are
 * not served; their content lives in the settings modal, opened by a
 * `#<tab>[/<subPath>]` hash over the current page (`useSettingsHash`). This maps
 * a classic path to that hash. Path FQN segments arrive URL-encoded
 * (`getEncodedFqn`) and are decoded before each panel's own `viewToSubPath`
 * re-encodes them the way its hash parser expects. Access-control, notification
 * and platform-settings sub-paths are spelled out here because importing their
 * panel utils would make the route builders import themselves (access control
 * links back to them) or pull in the settings menu and auth modules; the tests
 * pin all three against the panels' parsers.
 * ADR:2026-10-21-settings-pages-are-classic-only
 */
type HashMapper = (
  rest: string[],
  query: URLSearchParams
) => string | undefined;

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
    ? `${name}/rules/${encodeURIComponent(decode(rule))}/edit`
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
  const name = decode(fqn);

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
      return withSub('notification/alerts', fqn && decode(fqn));
    case ADD_NOTIFICATION:
      return 'notification/alerts/add';
    case EDIT_NOTIFICATION:
      return withSub('notification/alerts', fqn && `edit/${decode(fqn)}`);
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
  const itemId = option === SEARCH_SETTINGS ? item : undefined;

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

const ROOT_HASH_MAPPERS = new Map<string, HashMapper>([
  [
    'settings',
    ([category = '', ...rest], query) =>
      SETTINGS_HASH_MAPPERS.get(category)?.(rest, query),
  ],
  ['bots', ([name]) => (name ? `bots/${decode(name)}` : 'bots')],
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

  return ROOT_HASH_MAPPERS.get(root)?.(rest, new URLSearchParams(search));
};

/** Same condition `AppRouter` uses to render the AI shell. */
export const isAiShell = (): boolean =>
  useAppModeStore.getState().currentMode === AI_APP_MODE ||
  isAppModeSessionActive();

/**
 * Mode-aware link to a classic settings, marketplace or bots page — usable as a
 * react-router `to`, a `navigate()` target or an `href`. Classic: the path,
 * unchanged. AI: `<current search>#<tab>/<subPath>`, which keeps the current
 * page and opens the settings modal on it (`useSettingsHash` adopts pushed
 * hashes). The search is spelled out because react-router resolves a bare
 * `#hash` target with an empty search, dropping the page's query string. A
 * path with no modal equivalent is returned unchanged and lands on the AI
 * not-found page. Route builders call this, so callers stay unchanged.
 */
export const getSettingsLink = (path: string): string => {
  const hash = isAiShell() ? settingsPathToHash(path) : undefined;

  return hash === undefined ? path : `${globalThis.location.search}#${hash}`;
};

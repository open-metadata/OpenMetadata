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
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../../constants/GlobalSettings.constants';
import { safeDecodeURIComponent as decode } from '../../../discovery/personal-space/Profile/tabs/members/Members.utils';

/**
 * In AI mode, settings live in the personal-space modal (`#<tab>[/<subPath>]`,
 * see `useSettingsHash`), so the classic page routes that have a modal
 * equivalent are redirected to it. Each mapper takes the path segments after
 * its key and returns the modal hash (without `#`), or `undefined` to leave the
 * page route alone (services, search, workflow definitions, edit forms… have no
 * modal tab). Path FQN segments arrive URL-encoded: tabs whose hash parser
 * decodes (applications, members teams) keep them encoded, the rest decode.
 */
type HashMapper = (rest: string[]) => string | undefined;

const withSub = (tab: string, subPath?: string) =>
  subPath ? `${tab}/${subPath}` : tab;

const { TEAMS, USERS, ADMINS, ONLINE_USERS, ROLES, POLICIES } =
  GlobalSettingOptions;
const MEMBER_LISTS: string[] = [USERS, ADMINS, ONLINE_USERS];
const ACCESS_PAGES: string[] = [
  GlobalSettingOptions.PERMISSION_DEBUGGER,
  GlobalSettingOptions.AUDIT_LOGS,
];
const ACCESS_ADD_FORMS = ['add-role', 'add-policy'];

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
  [GlobalSettingOptions.SEARCH_SETTINGS]: 'search',
  [GlobalSettingOptions.OM_URL_CONFIG]: 'brand-url',
  [GlobalSettingOptions.DATA_ASSET_RULES]: 'data-asset-rules',
  [GlobalSettingOptions.LEARNING_RESOURCES]: 'learning-resources',
  [GlobalSettingOptions.APP_MODE]: 'app-mode',
  [GlobalSettingOptions.TIME_FORMAT]: 'time-format',
};

const GOVERNANCE_PAGES: Record<string, string> = {
  [GlobalSettingOptions.GLOSSARY_TERM_RELATIONS]: 'glossary-relations',
  [GlobalSettingOptions.INTAKE_FORMS]: 'intake-forms',
};

const lookup = (table: Record<string, string>, key: string) =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

const mapMembers: HashMapper = ([option, fqn]) => {
  if (!option) {
    return 'members';
  }
  if (option === TEAMS) {
    return withSub('members/teams', fqn);
  }

  return MEMBER_LISTS.includes(option) ? `members/${option}` : undefined;
};

const mapAccess: HashMapper = ([option, fqn, action, rule]) => {
  if (!option || ACCESS_PAGES.includes(option)) {
    return withSub('access-control', option);
  }
  if (option !== ROLES && option !== POLICIES) {
    return undefined;
  }
  if (!fqn || ACCESS_ADD_FORMS.includes(fqn)) {
    return `access-control/${withSub(option, fqn && 'add')}`;
  }
  const detail = `access-control/${option}/${decode(fqn)}`;
  if (action === 'add-rule') {
    return `${detail}/rules/add`;
  }

  return action === 'edit-rule' && rule
    ? `${detail}/rules/${rule}/edit`
    : detail;
};

const mapNotifications: HashMapper = ([option, fqn, ...rest]) => {
  switch (option) {
    case undefined:
      return 'notification';
    case GlobalSettingOptions.ALERTS:
      return withSub('notification/alerts', fqn && decode(fqn));
    case GlobalSettingOptions.ADD_NOTIFICATION:
      return 'notification/alerts/add';
    case GlobalSettingOptions.EDIT_NOTIFICATION:
      return withSub('notification/alerts', fqn && `edit/${decode(fqn)}`);
    default:
      // Every other notifications option (announcements, Collate's weekly
      // emails / templates) is a contributed section keyed by the same id.
      return `notification/section/${[option, fqn, ...rest]
        .filter(Boolean)
        .join('/')}`;
  }
};

const SETTINGS_HASH_MAPPERS = new Map<string, HashMapper>([
  ['', () => 'profile'],
  [GlobalSettingsMenuCategory.BOTS, () => 'bots'],
  [
    GlobalSettingsMenuCategory.APPLICATIONS,
    ([fqn]) => withSub('applications', fqn),
  ],
  [
    GlobalSettingsMenuCategory.PERSONA,
    ([fqn]) => withSub('personas', fqn && decode(fqn)),
  ],
  [GlobalSettingsMenuCategory.MEMBERS, mapMembers],
  [GlobalSettingsMenuCategory.ACCESS, mapAccess],
  [GlobalSettingsMenuCategory.NOTIFICATIONS, mapNotifications],
  [GlobalSettingsMenuCategory.CUSTOM_PROPERTIES, () => 'custom-properties'],
  [
    GlobalSettingsMenuCategory.GOVERNANCE,
    ([option]) => {
      const page = option ? lookup(GOVERNANCE_PAGES, option) : '';

      return page === undefined ? undefined : withSub('governance', page);
    },
  ],
  [
    GlobalSettingsMenuCategory.PREFERENCES,
    ([option]) => {
      const page = option ? lookup(PREFERENCE_PAGES, option) : '';

      return page === undefined
        ? undefined
        : withSub('platform-settings', page);
    },
  ],
  [GlobalSettingsMenuCategory.SSO, () => 'sso'],
  // Collate's billing pages share their slugs with the modal's `#billing/<page>`;
  // the plans page has no modal equivalent.
  [
    'billing',
    ([page]) => (page === 'plans' ? undefined : withSub('billing', page)),
  ],
]);

const ROOT_HASH_MAPPERS = new Map<string, HashMapper>([
  [
    'settings',
    ([category = '', ...rest]) => SETTINGS_HASH_MAPPERS.get(category)?.(rest),
  ],
  ['bots', ([name]) => (name ? `bots/${decode(name)}` : undefined)],
  [
    'create-user',
    ([kind]) => (kind === 'bot' ? 'bots/add' : 'members/users/create'),
  ],
  [
    'marketplace',
    ([, fqn, action]) =>
      withSub(
        'applications/marketplace',
        [fqn, action].filter(Boolean).join('/')
      ),
  ],
]);

/** Modal hash (without `#`) for a classic settings pathname, if it has one. */
export const settingsPathToHash = (pathname: string): string | undefined => {
  const [root = '', ...rest] = pathname.split('/').filter(Boolean);

  return ROOT_HASH_MAPPERS.get(root)?.(rest);
};

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

import { ENTITY_PATH } from '../../../../constants/constants';
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
 * modal tab; notifications/alerts have dedicated AI pages and persona details
 * keep their page). The bare `/settings` landing and `/create-user` are generic
 * entry points that AI-mode flows still drive as classic pages, so they stay.
 * Path FQN segments arrive URL-encoded: tabs whose hash parser decodes
 * (applications, members teams) keep them encoded, the rest decode.
 * See ADR:2026-10-20-app-mode-settings-urls-open-the-settings-modal.
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

const mapAccessDetail = (detail: string, action?: string, rule?: string) => {
  if (action === 'add-rule') {
    return `${detail}/rules/add`;
  }

  return action === 'edit-rule' && rule
    ? `${detail}/rules/${rule}/edit`
    : detail;
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

  return mapAccessDetail(
    `access-control/${option}/${decode(fqn)}`,
    action,
    rule
  );
};

const SETTINGS_HASH_MAPPERS = new Map<string, HashMapper>([
  [GlobalSettingsMenuCategory.BOTS, () => 'bots'],
  [
    GlobalSettingsMenuCategory.APPLICATIONS,
    ([fqn]) => withSub('applications', fqn),
  ],
  // Persona detail routes stay pages (app layout, customize landing page).
  [
    GlobalSettingsMenuCategory.PERSONA,
    ([fqn]) => (fqn ? undefined : 'personas'),
  ],
  [GlobalSettingsMenuCategory.MEMBERS, mapMembers],
  [GlobalSettingsMenuCategory.ACCESS, mapAccess],
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
  // Collate-only (it owns the billing pages and the `#billing` tab); their slugs
  // match the modal's `#billing/<page>`, the plans page has no modal equivalent.
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
  ['create-user', ([kind]) => (kind === 'bot' ? 'bots/add' : undefined)],
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

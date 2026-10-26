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
  Clock,
  ShieldTick,
  User01,
  Users01,
} from '@openmetadata/ui-core-components/icons';

import type {
  MembersLandingCard,
  StageState,
  TimeWindowOption,
  UserDetailTab,
} from './Members.types';

// Order is the tab-strip order in the user-detail header.
export const USER_DETAIL_TABS: UserDetailTab[] = [
  'overview',
  'access',
  'activity',
  'tasks',
  'owned-assets',
  'following',
  'custom-properties',
];

// User-detail tabs whose list scrolls inside a bounded body; the rest grow so
// the panel scrolls and the bottom padding stays below the content.
export const USER_DETAIL_TAB_LABEL_KEYS: Record<UserDetailTab, string> = {
  overview: 'label.overview',
  access: 'label.access',
  activity: 'label.activity',
  tasks: 'label.task-plural',
  'owned-assets': 'label.owned-asset-plural',
  following: 'label.following',
  'custom-properties': 'label.custom-property-plural',
};

export const SCROLLING_USER_DETAIL_TABS: ReadonlySet<UserDetailTab> = new Set([
  'activity',
  'tasks',
  'owned-assets',
  'following',
]);

export const LANDING_CARDS: MembersLandingCard[] = [
  {
    id: 'teams',
    icon: Users01,
    titleKey: 'label.team-plural',
    descriptionKey: 'message.members-teams-description',
    view: { type: 'teams' },
  },
  {
    id: 'users',
    icon: User01,
    titleKey: 'label.user-plural',
    descriptionKey: 'message.members-users-description',
    view: { type: 'users' },
  },
  {
    id: 'admins',
    icon: ShieldTick,
    titleKey: 'label.admin-plural',
    descriptionKey: 'message.members-admins-description',
    view: { type: 'admins' },
  },
  {
    id: 'online-users',
    icon: Clock,
    titleKey: 'label.online-user-plural',
    descriptionKey: 'message.members-online-users-description',
    view: { type: 'online-users' },
  },
];

export const TIME_WINDOW_OPTIONS: TimeWindowOption[] = [
  { value: 5, labelKey: 'label.last-n-minutes', labelParams: { n: 5 } },
  { value: 60, labelKey: 'label.last-hour' },
  { value: 1440, labelKey: 'label.last-24-hours' },
  { value: 10080, labelKey: 'label.last-7-days' },
  { value: 43200, labelKey: 'label.last-30-days' },
  { value: 0, labelKey: 'label.all-time' },
];

export const DEFAULT_TIME_WINDOW = 1440;

// Import-result CSV column keys folded into the status badge, plus the empty-cell
// placeholder used by the result table.
export const IMPORT_RESULT_STATUS_KEY = 'status';
export const IMPORT_RESULT_DETAILS_KEY = 'details';
export const IMPORT_RESULT_EMPTY_PLACEHOLDER = '--';

export const WIDGET_CLASS =
  'tw:flex tw:flex-1 tw:flex-col tw:gap-1 tw:min-w-[120px] tw:overflow-hidden tw:p-3';

// Status-chip utility pairs (bg-utility-{c}-50 + text-utility-{c}-700) — these flip
// together for dark mode; the plain bg-/fg- status tokens collapse to adjacent shades
// in dark (e.g. bg-success-secondary vs fg-success-primary) and hide the icon.
export const STAGE_ICON_CLASS: Record<StageState, string> = {
  done: 'tw:bg-utility-success-50 tw:text-utility-success-700',
  active: 'tw:bg-utility-brand-50 tw:text-utility-brand-700',
  pending: 'tw:bg-tertiary tw:text-fg-quaternary',
};

// Team detail tabs whose content is a borderless table drawn edge to edge in
// the tab card; the rest get padding.
export const TABLE_TABS = new Set<string>([
  'teams',
  'users',
  'roles',
  'policies',
]);

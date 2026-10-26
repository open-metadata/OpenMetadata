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

import type {
  BreadcrumbItemType,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import {
  Clock,
  ShieldTick,
  User01,
  Users01,
} from '@openmetadata/ui-core-components/icons';
import { isEmpty, xor } from 'lodash';
import type { FC, Key } from 'react';
import type { UIPermission } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../../../../enums/permissions.enum';
import type { EntityReference } from '../../../../../../generated/entity/type';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { userPermissions } from '../../../../../../utils/PermissionsUtils';
import type {
  MembersView,
  OnlineStatusInfo,
  ParsedImportResult,
  TeamNode,
  UserDetailTab,
} from './Members.types';
import {
  TASKS_TAB,
  TEAMS_ADD,
  TEAMS_IMPORT,
  TEAM_DETAIL,
  USER_DETAIL,
} from './membersRoute.utils';

// DomainSelect hands back a single ref, an array, or undefined (cleared);
// normalise to the array shape the Team PATCH expects.
export const toDomainArray = (
  next: EntityReference | EntityReference[] | undefined
): EntityReference[] => {
  if (Array.isArray(next)) {
    return next;
  }

  return next ? [next] : [];
};

// Team-inherited domains aren't the user's to edit: they stay out of the
// picker and go back to the server untouched (an `{ id, type }` rebuild would
// drop `inherited` and turn them into direct assignments).
export const getDirectDomains = (domains?: EntityReference[]) =>
  (domains ?? []).filter((domain) => !domain.inherited);

// Whether `directIds` differs from the user's directly assigned domains.
export const hasDirectDomainChanges = (
  current: EntityReference[] | undefined,
  directIds: string[]
) =>
  !isEmpty(
    xor(
      directIds,
      getDirectDomains(current).map((domain) => domain.id)
    )
  );

// The stored domain list with its direct part replaced by `directIds`;
// unchanged when the direct ids are the same.
export const mergeDomainEdits = (
  current: EntityReference[] | undefined,
  directIds: string[]
): EntityReference[] | undefined => {
  if (!hasDirectDomainChanges(current, directIds)) {
    return current;
  }
  const direct = getDirectDomains(current);

  return [
    ...(current ?? []).filter((domain) => domain.inherited),
    ...directIds.map(
      (id) =>
        direct.find((domain) => domain.id === id) ?? { id, type: 'domain' }
    ),
  ];
};

// Flatten the full team hierarchy (not just direct children) so nested teams —
// e.g. a Group under a Department — are assignable in the create-user form.
export const flattenTeamHierarchy = (teams: TeamNode[]): SelectItemType[] =>
  teams.flatMap((team) => [
    { id: team.id, label: getEntityName(team) },
    ...flattenTeamHierarchy(team.children ?? []),
  ]);

// Drop an id from a string[] field value (multi-select onItemCleared).
export const withoutId = (ids: string[], key: string | number): string[] =>
  ids.filter((id) => id !== String(key));

// Keep the currently-selected role items when merging a fresh server page, so a
// selection doesn't vanish just because it fell outside the latest search page.
export const mergeRoleItems = (
  prev: SelectItemType[],
  fetched: SelectItemType[],
  selected: string[]
): SelectItemType[] => {
  const kept = prev.filter((item) => selected.includes(String(item.id)));
  const keptIds = new Set(kept.map((k) => k.id));

  return [...kept, ...fetched.filter((n) => !keptIds.has(n.id))];
};

// Parse a result CSV (as papaparse string[][]) into header + keyed-cell rows for
// the import-result table.
export const toImportRows = (data: string[][]): ParsedImportResult => {
  const nonEmpty = data.filter((row) => row.some((cell) => cell !== ''));
  const [headerRow = [], ...dataRows] = nonEmpty;

  return {
    headers: headerRow,
    rows: dataRows.map((row, index) => {
      const cells = headerRow.reduce<Record<string, string>>(
        (record, header, column) => {
          record[header] = row[column] ?? '';

          return record;
        },
        {}
      );

      return { id: `${index}-${cells[headerRow[1]] ?? ''}`, cells };
    }),
  };
};

const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 1440;

export const formatOnlineStatus = (
  activityTime: number | undefined,
  t: (key: string, params?: Record<string, string | number>) => string
): OnlineStatusInfo => {
  if (!activityTime) {
    return { label: t('label.never'), colorClass: 'tw:text-tertiary' };
  }

  const diffMs = Date.now() - activityTime;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 5) {
    return {
      label: t('label.online-now'),
      colorClass: 'tw:text-success-primary',
    };
  }

  if (diffMinutes < MINUTES_IN_HOUR) {
    return {
      label: t('label.n-minutes-ago', { count: diffMinutes }),
      colorClass: 'tw:text-success-primary',
    };
  }

  if (diffMinutes < MINUTES_IN_DAY) {
    return {
      label: t('label.n-hours-ago', { count: diffHours }),
      colorClass: 'tw:text-warning-primary',
    };
  }

  return {
    label: t('label.n-days-ago', { count: diffDays }),
    colorClass: 'tw:text-error-primary',
  };
};

// ponytail: duplicated from BulkEntityImportPage (it keeps these private); ~15
// lines, cheaper than exporting from a page module and wiring a shared import.
const CSV_FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];
const BYTES_PER_UNIT = 1024;

// Data-row count = non-empty lines minus the header row.
export const getCsvRowCount = (content: string): number =>
  content.split(/\r\n|\n|\r/).filter((line, index) => index > 0 && line.trim())
    .length;

export const getCsvFileSizeLabel = (bytes = 0): string => {
  if (!bytes) {
    return `0 ${CSV_FILE_SIZE_UNITS[0]}`;
  }

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT)),
    CSV_FILE_SIZE_UNITS.length - 1
  );
  const normalizedSize = bytes / BYTES_PER_UNIT ** unitIndex;

  return `${normalizedSize.toFixed(unitIndex === 0 ? 0 : 1)} ${
    CSV_FILE_SIZE_UNITS[unitIndex]
  }`;
};

// Per-view icon map for the members header (pure data; keeps the header effect's
// complexity within budget).
export const getMembersIcons = (
  createUserIsAdmin: boolean,
  sectionIcon?: FC<{ className?: string }>
): Record<MembersView['type'], FC<{ className?: string }>> => ({
  section: sectionIcon ?? Users01,
  landing: Users01,
  teams: Users01,
  [TEAM_DETAIL]: Users01,
  [TEAMS_ADD]: Users01,
  [TEAMS_IMPORT]: Users01,
  users: User01,
  [USER_DETAIL]: User01,
  admins: ShieldTick,
  'user-create': createUserIsAdmin ? ShieldTick : User01,
  'online-users': Clock,
});

export const getMembersDescriptions = (
  t: (key: string) => string,
  createUserIsAdmin: boolean,
  sectionDescription?: string
): Record<MembersView['type'], string> => ({
  section: sectionDescription ?? '',
  landing: t('message.team-member-management-description'),
  teams: t('message.members-teams-description'),
  [TEAM_DETAIL]: t('message.members-teams-description'),
  [TEAMS_ADD]: t('message.members-teams-description'),
  [TEAMS_IMPORT]: t('message.members-teams-description'),
  users: t('message.members-users-description'),
  // The user-detail header supplies its own `@username · email` line.
  [USER_DETAIL]: '',
  admins: t('message.members-admins-description'),
  'user-create': createUserIsAdmin
    ? t('message.members-admins-description')
    : t('message.members-users-description'),
  'online-users': t('message.members-online-users-description'),
});

export const USER_DETAIL_BACK_TO_USERS = new Set<Key>([
  'settings',
  'members',
  'users',
]);

// The fetched display name wins once known; until then the sub-path's raw FQN
// stands in.
const getTeamDetailName = (view: MembersView, resolvedName: string) =>
  view.type === TEAM_DETAIL ? resolvedName || view.name : '';

export const makeBreadcrumbAction =
  (onNavigate: (view: MembersView) => void, view?: MembersView) =>
  (id: Key) => {
    // Inside a user's detail every ancestor up to Users returns to the users
    // list, and the user/Tasks crumbs above a task return to that user's tasks.
    if (view?.type === USER_DETAIL) {
      if (USER_DETAIL_BACK_TO_USERS.has(id)) {
        onNavigate({ type: 'users' });
      } else if (id === 'user' || id === 'user-tasks') {
        onNavigate({ type: USER_DETAIL, name: view.name, tab: TASKS_TAB });
      }

      return;
    }
    if (id === 'members') {
      onNavigate({ type: 'landing' });
    } else if (id === 'teams') {
      onNavigate({ type: 'teams' });
    } else if (id === 'users') {
      onNavigate({ type: 'users' });
    } else if (id === 'admins') {
      onNavigate({ type: 'admins' });
    }
  };

export const isTeamsOrDetailView = (view: MembersView): boolean =>
  view.type === 'teams' || view.type === TEAM_DETAIL || view.type === TEAMS_ADD;

const userDetailName = (view: MembersView): string =>
  view.type === USER_DETAIL ? view.name : '';

// `<username>` — or, on a task page, `<username> › Tasks › TASK-…`, where the
// first two crumbs lead back to the user's task list.
const userDetailCrumbs = (
  view: MembersView,
  t: (key: string) => string
): BreadcrumbItemType[] => {
  if (view.type !== USER_DETAIL) {
    return [];
  }
  if (!view.taskId) {
    return [{ id: 'current', label: view.name }];
  }

  return [
    { id: 'user', label: view.name },
    { id: 'user-tasks', label: t('label.task-plural') },
    { id: 'current', label: view.taskId },
  ];
};

// Builds the per-view breadcrumb/title/icon/description maps for the members
// header. Pure, so the header effect stays within its complexity budget.
export const buildMembersHeaderMaps = (
  view: MembersView,
  t: (key: string, opts?: Record<string, unknown>) => string,
  // Display name a detail view resolved after fetching (team or user); the
  // sub-path alone only carries the FQN / username.
  resolvedName: string,
  // A contributed section supplies its own label/description/icon (there is no
  // settings-menu entry to borrow them from), so the panel passes them in.
  section?: {
    title: string;
    description?: string;
    icon?: FC<{ className?: string }>;
  }
) => {
  const membersLabel = t('label.member-plural');
  const organizationLabel = t('label.organization');
  const teamsLabel = t('label.team-plural');
  const usersLabel = t('label.user-plural');
  const adminsLabel = t('label.admin-plural');
  const onlineUsersLabel = t('label.online-user-plural');
  const addTeamLabel = t('label.add-entity', { entity: t('label.team') });
  const importIsUser =
    view.type === TEAMS_IMPORT && view.importType === 'users';
  const importLabel = t('label.import-entity', {
    entity: importIsUser ? t('label.user') : t('label.team'),
  });
  const teamName = getTeamDetailName(view, resolvedName);

  const settingsItem: BreadcrumbItemType = {
    id: 'settings',
    label: t('label.setting-plural'),
  };
  const membersItem: BreadcrumbItemType = {
    id: 'members',
    label: membersLabel,
  };
  const teamsItem: BreadcrumbItemType = {
    id: 'teams',
    label: organizationLabel,
  };
  const usersItem: BreadcrumbItemType = { id: 'users', label: usersLabel };
  const adminsItem: BreadcrumbItemType = { id: 'admins', label: adminsLabel };
  const base = [settingsItem, membersItem];

  const createUserIsAdmin =
    view.type === 'user-create' && Boolean(view.isAdmin);
  const createUserLabel = t('label.create-entity', {
    entity: createUserIsAdmin ? t('label.admin') : t('label.user'),
  });

  const crumbsByType: Record<MembersView['type'], BreadcrumbItemType[]> = {
    landing: [settingsItem, { id: 'current', label: membersLabel }],
    teams: [...base, { id: 'current', label: teamsLabel }],
    [TEAM_DETAIL]: [...base, teamsItem, { id: 'current', label: teamName }],
    [TEAMS_ADD]: [...base, teamsItem, { id: 'current', label: addTeamLabel }],
    [TEAMS_IMPORT]: [...base, teamsItem, { id: 'current', label: importLabel }],
    users: [...base, { id: 'current', label: usersLabel }],
    [USER_DETAIL]: [...base, usersItem, ...userDetailCrumbs(view, t)],
    admins: [...base, { id: 'current', label: adminsLabel }],
    'user-create': [
      ...base,
      createUserIsAdmin ? adminsItem : usersItem,
      { id: 'current', label: createUserLabel },
    ],
    'online-users': [...base, { id: 'current', label: onlineUsersLabel }],
    section: [...base, { id: 'current', label: section?.title ?? '' }],
  };

  const titleByType: Record<MembersView['type'], string> = {
    landing: membersLabel,
    teams: organizationLabel,
    [TEAM_DETAIL]: teamName,
    [TEAMS_ADD]: addTeamLabel,
    [TEAMS_IMPORT]: importLabel,
    users: usersLabel,
    [USER_DETAIL]: userDetailName(view),
    admins: adminsLabel,
    'user-create': createUserLabel,
    'online-users': onlineUsersLabel,
    section: section?.title ?? '',
  };

  return {
    crumbsByType,
    titleByType,
    iconByType: getMembersIcons(createUserIsAdmin, section?.icon),
    descByType: getMembersDescriptions(
      t,
      createUserIsAdmin,
      section?.description
    ),
  };
};

/**
 * Tabs a viewer can't use on a user's detail. Bots follow nothing; another
 * user's permission debug info is admin-only on the server (it would 403);
 * custom properties need view access on that user.
 */
export const getHiddenUserDetailTabs = ({
  isBot,
  canViewAccess,
  canViewCustomProperties,
}: {
  isBot?: boolean;
  canViewAccess: boolean;
  canViewCustomProperties: boolean;
}): ReadonlySet<UserDetailTab> => {
  const hidden = new Set<UserDetailTab>();
  if (isBot) {
    hidden.add('following');
  }
  if (!canViewAccess) {
    hidden.add('access');
  }
  if (!canViewCustomProperties) {
    hidden.add('custom-properties');
  }

  return hidden;
};

/**
 * What a viewer may open under Members, as in the classic settings menu: Teams
 * needs view on teams, Users and Admins need view on users, Online users is
 * admin-only. Admins see everything.
 */
export interface MembersAccess {
  teams: boolean;
  users: boolean;
  onlineUsers: boolean;
}

export const getMembersAccess = (
  permissions: UIPermission,
  isAdmin: boolean
): MembersAccess => ({
  teams:
    isAdmin ||
    Boolean(
      userPermissions.hasViewPermissions(ResourceEntity.TEAM, permissions)
    ),
  users:
    isAdmin ||
    Boolean(
      userPermissions.hasViewPermissions(ResourceEntity.USER, permissions)
    ),
  onlineUsers: isAdmin,
});

export const canOpenMembers = (access: MembersAccess): boolean =>
  access.teams || access.users;

const CARD_ACCESS: Record<string, keyof MembersAccess> = {
  teams: 'teams',
  users: 'users',
  admins: 'users',
  'online-users': 'onlineUsers',
};

/** Landing cards; contributed sections carry their own checks. */
export const isMembersCardAllowed = (
  cardId: string,
  access: MembersAccess
): boolean => {
  const key = CARD_ACCESS[cardId];

  return key ? access[key] : true;
};

const VIEW_ACCESS: Partial<Record<MembersView['type'], keyof MembersAccess>> = {
  teams: 'teams',
  'team-detail': 'teams',
  'teams-add': 'teams',
  users: 'users',
  admins: 'users',
  'user-detail': 'users',
  'online-users': 'onlineUsers',
};

/** Guards a deep-linked view the landing would not have offered. */
export const isMembersViewAllowed = (
  view: MembersView,
  access: MembersAccess
): boolean => {
  const key = VIEW_ACCESS[view.type];

  return key ? access[key] : true;
};

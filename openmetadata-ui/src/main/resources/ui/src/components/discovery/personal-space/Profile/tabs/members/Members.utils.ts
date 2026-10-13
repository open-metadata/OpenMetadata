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
import type { FC, Key } from 'react';
import { GlobalSettingOptions } from '../../../../../../constants/GlobalSettings.constants';
import type { EntityReference } from '../../../../../../generated/entity/type';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import type {
  MembersView,
  OnlineStatusInfo,
  ParsedImportResult,
  TeamNode,
} from './Members.types';

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

// Route-segment values reuse the shared settings enum; the form-only suffixes
// below have no enum equivalent.
const { TEAMS, USERS, ADMINS, ONLINE_USERS } = GlobalSettingOptions;
const ADD = 'add';
const CREATE = 'create';
const USER_CREATE = 'user-create';
const IMPORT_TEAM = 'import-team';
const IMPORT_USER = 'import-user';
// View-type discriminants reused across the route parser and the header maps;
// consts (not repeated literals) keep no-duplicate-string happy.
const SECTION = 'section';
const TEAM_DETAIL = 'team-detail';
const TEAMS_ADD = 'teams-add';
const TEAMS_IMPORT = 'teams-import';

// A malformed percent-escape (e.g. a hand-edited `#...%ZZ`) makes
// decodeURIComponent throw URIError, which would unmount the whole panel; fall
// back to the raw value so a bad hash degrades gracefully instead of crashing.
export const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// fqns are URL-encoded in the hash to survive the round-trip (they can contain
// `%`, `.`, `/`); decode the fqn segments back here.
// ponytail: a team literally named `add`/`import-team`/`import-user` collides with
// the form-route suffixes and routes to the form instead of team-detail — tolerated
// for now since those names are unusual; disambiguate with a sentinel if it bites.
function parseTeamsSubPath(parts: string[]): MembersView {
  if (parts.length === 1) {
    return { type: 'teams' };
  }

  const last = parts[parts.length - 1];

  if (last === ADD) {
    // `teams/add` = top-level; `teams/<parentFqn>/add` = child under a parent.
    const parentFqn =
      parts.length === 2
        ? undefined
        : safeDecodeURIComponent(parts.slice(1, -1).join('/'));

    return { type: TEAMS_ADD, parentFqn };
  }

  if (last === IMPORT_TEAM || last === IMPORT_USER) {
    // `teams/<fqn>/import-team` or `.../import-user` — fqn is everything between.
    return {
      type: TEAMS_IMPORT,
      fqn: safeDecodeURIComponent(parts.slice(1, -1).join('/')),
      importType: last === IMPORT_USER ? 'users' : 'teams',
    };
  }

  const fqn = safeDecodeURIComponent(parts.slice(1).join('/'));

  return { type: TEAM_DETAIL, fqn, name: fqn };
}

// `section/<key>[/<subPath>]` — a contributed section owns everything below its
// key, so the remainder is handed through untouched. Extracted (like
// parseTeamsSubPath) to keep hashSubPathToView within the complexity budget.
function parseSectionSubPath(parts: string[]): MembersView {
  const [, key, ...rest] = parts;

  return key
    ? { type: SECTION, key, subPath: rest.join('/') || undefined }
    : { type: 'landing' };
}

export function hashSubPathToView(subPath: string): MembersView {
  if (!subPath) {
    return { type: 'landing' };
  }

  const parts = subPath.split('/');

  switch (parts[0]) {
    case TEAMS:
      return parseTeamsSubPath(parts);
    case USERS:
      return parts[1] === CREATE
        ? { type: USER_CREATE, isAdmin: false }
        : { type: 'users' };
    case ADMINS:
      return parts[1] === CREATE
        ? { type: USER_CREATE, isAdmin: true }
        : { type: 'admins' };
    case ONLINE_USERS:
      return { type: 'online-users' };
    case SECTION:
      return parseSectionSubPath(parts);
    default:
      return { type: 'landing' };
  }
}

function teamsViewToSubPath(view: MembersView): string {
  switch (view.type) {
    case TEAM_DETAIL:
      return `${TEAMS}/${encodeURIComponent(view.fqn)}`;
    case TEAMS_ADD:
      return view.parentFqn
        ? `${TEAMS}/${encodeURIComponent(view.parentFqn)}/${ADD}`
        : `${TEAMS}/${ADD}`;
    case TEAMS_IMPORT:
      return `${TEAMS}/${encodeURIComponent(view.fqn)}/${
        view.importType === 'users' ? IMPORT_USER : IMPORT_TEAM
      }`;
    default:
      return TEAMS;
  }
}

export function viewToSubPath(view: MembersView): string | undefined {
  if (view.type === 'landing') {
    return undefined;
  }
  if (view.type === 'users') {
    return USERS;
  }
  if (view.type === 'admins') {
    return ADMINS;
  }
  if (view.type === 'online-users') {
    return ONLINE_USERS;
  }
  if (view.type === USER_CREATE) {
    return view.isAdmin ? `${ADMINS}/${CREATE}` : `${USERS}/${CREATE}`;
  }
  if (view.type === SECTION) {
    return view.subPath
      ? `${SECTION}/${view.key}/${view.subPath}`
      : `${SECTION}/${view.key}`;
  }

  // teams, team-detail, teams-add, teams-import
  return teamsViewToSubPath(view);
}

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
  admins: t('message.members-admins-description'),
  'user-create': createUserIsAdmin
    ? t('message.members-admins-description')
    : t('message.members-users-description'),
  'online-users': t('message.members-online-users-description'),
});

export const makeBreadcrumbAction =
  (onNavigate: (view: MembersView) => void) => (id: Key) => {
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

// Builds the per-view breadcrumb/title/icon/description maps for the members
// header. Pure, so the header effect stays within its complexity budget.
export const buildMembersHeaderMaps = (
  view: MembersView,
  t: (key: string, opts?: Record<string, unknown>) => string,
  resolvedTeamName: string,
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
  const teamName =
    view.type === TEAM_DETAIL ? resolvedTeamName || view.name : '';

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

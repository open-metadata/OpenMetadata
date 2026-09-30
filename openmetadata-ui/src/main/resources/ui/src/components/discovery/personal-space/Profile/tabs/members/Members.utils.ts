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

import type { MembersView, OnlineStatusInfo } from './Members.types';

const TEAMS = 'teams';
const USERS = 'users';
const ADMINS = 'admins';
const ADD = 'add';
const CREATE = 'create';
const ONLINE_USERS = 'online-users';

// fqns are URL-encoded in the hash to survive the round-trip (they can contain
// `%`, `.`, `/`); decode the fqn segments back here.
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
        : decodeURIComponent(parts.slice(1, -1).join('/'));

    return { type: 'teams-add', parentFqn };
  }

  const fqn = decodeURIComponent(parts.slice(1).join('/'));

  return { type: 'team-detail', fqn, name: fqn };
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
        ? { type: 'user-create', isAdmin: false }
        : { type: 'users' };
    case ADMINS:
      return parts[1] === CREATE
        ? { type: 'user-create', isAdmin: true }
        : { type: 'admins' };
    case ONLINE_USERS:
      return { type: 'online-users' };
    default:
      return { type: 'landing' };
  }
}

function teamsViewToSubPath(view: MembersView): string {
  switch (view.type) {
    case 'team-detail':
      return `${TEAMS}/${encodeURIComponent(view.fqn)}`;
    case 'teams-add':
      return view.parentFqn
        ? `${TEAMS}/${encodeURIComponent(view.parentFqn)}/${ADD}`
        : `${TEAMS}/${ADD}`;
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
  if (view.type === 'user-create') {
    return view.isAdmin ? `${ADMINS}/${CREATE}` : `${USERS}/${CREATE}`;
  }

  // teams, team-detail, teams-add
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

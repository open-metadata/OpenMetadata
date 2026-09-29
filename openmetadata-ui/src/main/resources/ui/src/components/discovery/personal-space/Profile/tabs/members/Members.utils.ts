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

export function hashSubPathToView(subPath: string): MembersView {
  if (!subPath) {
    return { type: 'landing' };
  }

  const parts = subPath.split('/');

  if (parts[0] === 'teams') {
    if (parts.length === 1) {
      return { type: 'teams' };
    }

    if (parts[1] === 'add') {
      return { type: 'teams-add' };
    }

    const fqn = parts.slice(1).join('/');

    return { type: 'team-detail', fqn, name: parts[1] };
  }

  if (parts[0] === 'users') {
    if (parts[1] === 'create') {
      return { type: 'user-create', isAdmin: false };
    }

    return { type: 'users' };
  }

  if (parts[0] === 'admins') {
    if (parts[1] === 'create') {
      return { type: 'user-create', isAdmin: true };
    }

    return { type: 'admins' };
  }

  if (parts[0] === 'online-users') {
    return { type: 'online-users' };
  }

  return { type: 'landing' };
}

export function viewToSubPath(view: MembersView): string | undefined {
  switch (view.type) {
    case 'landing':
      return undefined;
    case 'teams':
      return 'teams';
    case 'team-detail':
      return `teams/${view.fqn}`;
    case 'teams-add':
      return 'teams/add';
    case 'users':
      return 'users';
    case 'admins':
      return 'admins';
    case 'user-create':
      return view.isAdmin ? 'admins/create' : 'users/create';
    case 'online-users':
      return 'online-users';
    default:
      return undefined;
  }
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

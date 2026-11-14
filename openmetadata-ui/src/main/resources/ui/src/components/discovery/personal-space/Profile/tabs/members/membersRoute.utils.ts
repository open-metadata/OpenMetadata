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

import { GlobalSettingOptions } from '../../../../../../constants/GlobalSettings.constants';
import { safeDecodeURIComponent } from '../../../../../../utils/SettingsHashUtils';
import { USER_DETAIL_TABS } from './Members.constants';
import type {
  MembersUserDetailView,
  MembersView,
  UserDetailTab,
} from './Members.types';

// Route-segment values reuse the shared settings enum; the form-only suffixes
// below have no enum equivalent.
const { TEAMS, USERS, ADMINS, ONLINE_USERS } = GlobalSettingOptions;
const ADD = 'add';
const CREATE = 'create';
const USER_CREATE = 'user-create';
// Singular segment for a user's detail, so a user named `create` can't collide
// with the `users/create` form.
const USER = 'user';
const IMPORT_TEAM = 'import-team';
const IMPORT_USER = 'import-user';

// View-type discriminants reused across the route parser and the header maps;
// consts (not repeated literals) keep no-duplicate-string happy.
const SECTION = 'section';
// `teams/<fqn>/tab/<key>[/<subPath>]` — a contributed team tab's own sub-page.
const TAB = 'tab';

export const TEAM_DETAIL = 'team-detail';
export const TEAMS_ADD = 'teams-add';
export const TEAM_TAB_SUBPAGE = 'team-tab-subpage';
export const TEAMS_IMPORT = 'teams-import';
export const USER_DETAIL = 'user-detail';
export const TASKS_TAB: UserDetailTab = 'tasks';

// fqns are URL-encoded in the hash to survive the round-trip (they can contain
// `%`, `.`, `/`); decode the fqn segments back here.
// ponytail: a team literally named `add`/`import-team`/`import-user` collides with
// the form-route suffixes and routes to the form instead of team-detail — tolerated
// for now since those names are unusual; disambiguate with a sentinel if it bites.
function parseTeamsSubPath(parts: string[]): MembersView {
  if (parts.length === 1) {
    return { type: 'teams' };
  }

  // `teams/<fqn>/tab/<key>[/<subPath>]` — everything after the key belongs to
  // the contributed tab, so hand the remainder through untouched.
  // `teams/<fqn>/tab/<key>/<teamId>[/<subPath>]`. The team id rides in the
  // route because a contributed tab keys its API calls on the id, not the fqn,
  // and a deep link has no team loaded to look it up from.
  const tabAt = parts.indexOf(TAB, 1);
  if (tabAt > 1 && parts.length > tabAt + 2) {
    const fqn = safeDecodeURIComponent(parts.slice(1, tabAt).join('/'));
    const [key, teamId, ...rest] = parts.slice(tabAt + 1);

    return {
      type: TEAM_TAB_SUBPAGE,
      fqn,
      teamId,
      key,
      subPath: rest.join('/') || undefined,
    };
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

// `user/<name>[/<tab>[/<taskId>]]`. An unknown tab segment falls back to
// overview, and a task id is only honoured under the tasks tab.
function parseUserDetailSubPath(
  name: string,
  tabPart?: string,
  taskId?: string
): MembersView {
  const tab = USER_DETAIL_TABS.find((item) => item === tabPart) ?? 'overview';

  return {
    type: USER_DETAIL,
    name: safeDecodeURIComponent(name),
    tab,
    ...(tab === TASKS_TAB && taskId
      ? { taskId: safeDecodeURIComponent(taskId) }
      : {}),
  };
}

// `users[/create]`, `admins[/create]` and `user/<name>/…`; `users/<name>/…` is
// still read so links shared before the singular form keep working.
function parseUsersSubPath(parts: string[]): MembersView {
  const [root, next, ...rest] = parts;
  if (root === ADMINS) {
    return next === CREATE
      ? { type: USER_CREATE, isAdmin: true }
      : { type: 'admins' };
  }
  if (!next) {
    return { type: 'users' };
  }

  return root === USERS && next === CREATE
    ? { type: USER_CREATE, isAdmin: false }
    : parseUserDetailSubPath(next, rest[0], rest[1]);
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
    case ADMINS:
    case USER:
      return parseUsersSubPath(parts);
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
    case TEAM_TAB_SUBPAGE: {
      const base = `${TEAMS}/${encodeURIComponent(view.fqn)}/${TAB}/${
        view.key
      }/${encodeURIComponent(view.teamId)}`;

      return view.subPath ? `${base}/${view.subPath}` : base;
    }
    default:
      return TEAMS;
  }
}

// `<name>[/<tab>[/<taskId>]]`; overview is the default tab, so it is left out.
function userDetailTail(view: MembersUserDetailView): string {
  const tabPart = view.tab === 'overview' ? [] : [view.tab];
  const taskPart =
    view.tab === TASKS_TAB && view.taskId
      ? [encodeURIComponent(view.taskId)]
      : [];

  return [encodeURIComponent(view.name), ...tabPart, ...taskPart].join('/');
}

const userDetailViewToSubPath = (view: MembersUserDetailView): string =>
  `${USER}/${userDetailTail(view)}`;

export function viewToSubPath(view: MembersView): string | undefined {
  if (view.type === 'landing') {
    return undefined;
  }
  if (view.type === 'users') {
    return USERS;
  }
  if (view.type === USER_DETAIL) {
    return userDetailViewToSubPath(view);
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

// Another user's detail opened from the Profile tab (`#profile/<name>[/<tab>
// [/<taskId>]]`) reuses the Members `user/…` encoding, minus its prefix.
export const profileSubPathToUserView = (
  subPath: string
): MembersUserDetailView | undefined => {
  const view = hashSubPathToView(`${USER}/${subPath}`);

  return view.type === USER_DETAIL ? view : undefined;
};

// The user detail a `#profile/…` sub-path opens, if any. Your own name alone is
// your own Profile; an explicit tab or task still opens the detail, so a shared
// `#profile/<you>/tasks/<id>` link opens that task instead of your Profile.
export const getProfileUserDetailView = (
  subPath: string,
  currentUserName?: string
): MembersUserDetailView | undefined => {
  const view = profileSubPathToUserView(subPath);
  const isOwnProfile =
    view?.name === currentUserName && view?.tab === 'overview' && !view?.taskId;

  return isOwnProfile ? undefined : view;
};

export const userViewToProfileSubPath = userDetailTail;

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

import type { MembersView } from './Members.types';
import {
  buildMembersHeaderMaps,
  canOpenMembers,
  formatOnlineStatus,
  getCsvFileSizeLabel,
  getCsvRowCount,
  getHiddenUserDetailTabs,
  getMembersAccess,
  hasDirectDomainChanges,
  isMembersCardAllowed,
  isMembersViewAllowed,
  makeBreadcrumbAction,
  mergeDomainEdits,
} from './Members.utils';

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}${JSON.stringify(params)}` : key;

describe('getCsvRowCount', () => {
  it('counts data rows excluding the header and blank lines', () => {
    expect(getCsvRowCount('name,email\na,a@x.com\nb,b@x.com')).toBe(2);
    expect(getCsvRowCount('name,email\na,a@x.com\n\n')).toBe(1);
    expect(getCsvRowCount('name,email')).toBe(0);
    expect(getCsvRowCount('')).toBe(0);
  });
});

describe('getCsvFileSizeLabel', () => {
  it('formats byte sizes into B/KB/MB', () => {
    expect(getCsvFileSizeLabel(0)).toBe('0 B');
    expect(getCsvFileSizeLabel(512)).toBe('512 B');
    expect(getCsvFileSizeLabel(1024)).toBe('1.0 KB');
    expect(getCsvFileSizeLabel(1024 * 1024 * 2)).toBe('2.0 MB');
  });
});

describe('formatOnlineStatus', () => {
  it('returns "never" for undefined activityTime', () => {
    const result = formatOnlineStatus(undefined, t);

    expect(result.label).toBe('label.never');
    expect(result.colorClass).toBe('tw:text-tertiary');
  });

  it('returns "online now" for activity less than 5 minutes ago', () => {
    const result = formatOnlineStatus(Date.now() - 60000, t);

    expect(result.label).toBe('label.online-now');
    expect(result.colorClass).toBe('tw:text-success-primary');
  });

  it('returns minutes ago for activity between 5 and 60 minutes ago', () => {
    const result = formatOnlineStatus(Date.now() - 30 * 60000, t);

    expect(result.label).toContain('label.n-minutes-ago');
    expect(result.colorClass).toBe('tw:text-success-primary');
  });

  it('returns hours ago for activity between 1 and 24 hours ago', () => {
    const result = formatOnlineStatus(Date.now() - 3 * 3600000, t);

    expect(result.label).toContain('label.n-hours-ago');
    expect(result.colorClass).toBe('tw:text-warning-primary');
  });

  it('returns days ago for activity more than 24 hours ago', () => {
    const result = formatOnlineStatus(Date.now() - 3 * 86400000, t);

    expect(result.label).toContain('label.n-days-ago');
    expect(result.colorClass).toBe('tw:text-error-primary');
  });
});

describe('user-detail header', () => {
  it('ends the breadcrumbs at the username', () => {
    const view: MembersView = {
      type: 'user-detail',
      name: 'alice',
      tab: 'access',
    };
    const { crumbsByType, titleByType } = buildMembersHeaderMaps(
      view,
      (key: string) => key,
      ''
    );

    expect(crumbsByType['user-detail'].map((c) => c.label)).toEqual([
      'label.setting-plural',
      'label.member-plural',
      'label.user-plural',
      'alice',
    ]);
    expect(titleByType['user-detail']).toBe('alice');
  });

  it('adds Tasks and the task id on a task page', () => {
    const view: MembersView = {
      type: 'user-detail',
      name: 'alice',
      tab: 'tasks',
      taskId: 'TASK-00170',
    };
    const { crumbsByType } = buildMembersHeaderMaps(
      view,
      (key: string) => key,
      ''
    );

    expect(crumbsByType['user-detail'].map((c) => c.id)).toEqual([
      'settings',
      'members',
      'users',
      'user',
      'user-tasks',
      'current',
    ]);
    expect(crumbsByType['user-detail'][5].label).toBe('TASK-00170');
  });

  it('sends Settings/Members/Users to the users list and user/Tasks to the task list', () => {
    const onNavigate = jest.fn();
    const action = makeBreadcrumbAction(onNavigate, {
      type: 'user-detail',
      name: 'alice',
      tab: 'tasks',
      taskId: 'TASK-1',
    });

    ['settings', 'members', 'users'].forEach((id) => action(id));
    action('user');
    action('user-tasks');

    expect(onNavigate.mock.calls.map(([view]) => view)).toEqual([
      { type: 'users' },
      { type: 'users' },
      { type: 'users' },
      { type: 'user-detail', name: 'alice', tab: 'tasks' },
      { type: 'user-detail', name: 'alice', tab: 'tasks' },
    ]);
  });
});

describe('getHiddenUserDetailTabs', () => {
  it('hides nothing for an admin viewing a person with custom property access', () => {
    expect(
      getHiddenUserDetailTabs({
        canViewAccess: true,
        canViewCustomProperties: true,
      }).size
    ).toBe(0);
  });

  it('hides Access from a viewer who is neither an admin nor that user', () => {
    expect(
      getHiddenUserDetailTabs({
        canViewAccess: false,
        canViewCustomProperties: true,
      })
    ).toEqual(new Set(['access']));
  });

  it('hides Following for a bot and Custom Properties without view access', () => {
    expect(
      getHiddenUserDetailTabs({
        isBot: true,
        canViewAccess: true,
        canViewCustomProperties: false,
      })
    ).toEqual(new Set(['following', 'custom-properties']));
  });
});

describe('Members access (classic parity)', () => {
  const viewTeams = { team: { ViewAll: true } } as never;

  it('lets an admin open everything', () => {
    const access = getMembersAccess({} as never, true);

    expect(access).toEqual({ teams: true, users: true, onlineUsers: true });
    expect(canOpenMembers(access)).toBe(true);
  });

  it('opens Members to a non-admin who can view teams, without Online users', () => {
    const access = getMembersAccess(viewTeams, false);

    expect(canOpenMembers(access)).toBe(true);
    expect(isMembersCardAllowed('teams', access)).toBe(true);
    expect(isMembersCardAllowed('users', access)).toBe(false);
    expect(isMembersCardAllowed('online-users', access)).toBe(false);
    expect(isMembersCardAllowed('a-contributed-section', access)).toBe(true);
  });

  it('keeps Members closed to a viewer with neither team nor user view', () => {
    expect(canOpenMembers(getMembersAccess({} as never, false))).toBe(false);
  });

  it('guards deep links to views the landing would not offer', () => {
    const access = getMembersAccess(viewTeams, false);

    expect(
      isMembersViewAllowed({ type: 'team-detail', fqn: 'x', name: 'x' }, access)
    ).toBe(true);
    expect(isMembersViewAllowed({ type: 'online-users' }, access)).toBe(false);
    expect(isMembersViewAllowed({ type: 'users' }, access)).toBe(false);
    expect(isMembersViewAllowed({ type: 'landing' }, access)).toBe(true);
  });
});

describe('mergeDomainEdits', () => {
  const inherited = {
    id: 'd-team',
    type: 'domain',
    name: 'TeamDomain',
    inherited: true,
  };
  const direct = { id: 'd1', type: 'domain', name: 'Sales' };

  it('returns the stored list unchanged when the direct ids are the same', () => {
    const current = [inherited, direct];

    expect(mergeDomainEdits(current, ['d1'])).toBe(current);
  });

  it('replaces only the direct domains and keeps inherited refs untouched', () => {
    expect(mergeDomainEdits([inherited, direct], ['d2'])).toEqual([
      inherited,
      { id: 'd2', type: 'domain' },
    ]);
  });

  describe('hasDirectDomainChanges', () => {
    const current = [
      { id: 'd-team', type: 'domain', inherited: true },
      { id: 'd1', type: 'domain' },
    ];

    it('compares only the direct domains, by id', () => {
      expect(hasDirectDomainChanges(current, ['d1'])).toBe(false);
      expect(hasDirectDomainChanges(current, [])).toBe(true);
      expect(hasDirectDomainChanges(current, ['d1', 'd2'])).toBe(true);
    });
  });
});

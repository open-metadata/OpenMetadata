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
  getProfileUserDetailView,
  hashSubPathToView,
  profileSubPathToUserView,
  userViewToProfileSubPath,
  viewToSubPath,
} from './membersRoute.utils';

describe('hash <-> view round-trip', () => {
  it('encodes and decodes a team fqn containing special characters', () => {
    const fqn = 'PW%data_consumer_team-131661dd';
    const subPath = viewToSubPath({ type: 'team-detail', fqn, name: fqn });

    expect(subPath).toBe(`teams/${encodeURIComponent(fqn)}`);
    expect(hashSubPathToView(subPath as string)).toEqual({
      type: 'team-detail',
      fqn,
      name: fqn,
    });
  });

  it('round-trips a dotted team fqn', () => {
    const fqn = 'Engineering.Data.Platform';
    const view = hashSubPathToView(
      viewToSubPath({ type: 'team-detail', fqn, name: fqn }) as string
    );

    expect(view).toEqual({ type: 'team-detail', fqn, name: fqn });
  });

  it('maps teams/add to the add view (not a team named "add")', () => {
    expect(hashSubPathToView('teams/add')).toEqual({ type: 'teams-add' });
  });

  it('round-trips a team import view', () => {
    const fqn = 'Engineering.Data';
    const view = {
      type: 'teams-import' as const,
      fqn,
      importType: 'teams' as const,
    };
    const subPath = viewToSubPath(view);

    expect(subPath).toBe(`teams/${encodeURIComponent(fqn)}/import-team`);
    expect(hashSubPathToView(subPath as string)).toEqual(view);
  });

  it('round-trips a user import view', () => {
    const fqn = 'Organization';
    const view = {
      type: 'teams-import' as const,
      fqn,
      importType: 'users' as const,
    };
    const subPath = viewToSubPath(view);

    expect(subPath).toBe(`teams/${encodeURIComponent(fqn)}/import-user`);
    expect(hashSubPathToView(subPath as string)).toEqual(view);
  });
});

describe('contributed section hash routing', () => {
  it('round-trips a section view', () => {
    const view = { type: 'section' as const, key: 'provisioning' };

    expect(viewToSubPath(view)).toBe('section/provisioning');
    expect(hashSubPathToView('section/provisioning')).toEqual(view);
  });

  it('round-trips a section sub-path, which the section owns', () => {
    const view = {
      type: 'section' as const,
      key: 'provisioning',
      subPath: 'edit/mapping-1',
    };

    expect(viewToSubPath(view)).toBe('section/provisioning/edit/mapping-1');
    expect(hashSubPathToView('section/provisioning/edit/mapping-1')).toEqual(
      view
    );
  });

  it('falls back to landing when the section key is missing', () => {
    expect(hashSubPathToView('section')).toEqual({ type: 'landing' });
  });

  it('does not treat a team named "section" as a contributed section', () => {
    // `section` is a top-level segment; team fqns live under `teams/`.
    expect(hashSubPathToView('teams/section')).toEqual({
      type: 'team-detail',
      fqn: 'section',
      name: 'section',
    });
  });
});

describe('user-detail hash routing', () => {
  it('keeps the overview tab out of the hash and encodes the name', () => {
    const view: MembersView = {
      type: 'user-detail',
      name: 'john.doe@acme.io',
      tab: 'overview',
    };
    const subPath = viewToSubPath(view);

    expect(subPath).toBe(`user/${encodeURIComponent('john.doe@acme.io')}`);
    expect(hashSubPathToView(subPath as string)).toEqual(view);
  });

  it('round-trips a non-default tab', () => {
    const view: MembersView = {
      type: 'user-detail',
      name: 'alice',
      tab: 'owned-assets',
    };

    expect(viewToSubPath(view)).toBe('user/alice/owned-assets');
    expect(hashSubPathToView('user/alice/owned-assets')).toEqual(view);
    // Links shared before the singular form still open the same view.
    expect(hashSubPathToView('users/alice/owned-assets')).toEqual(view);
  });

  it('round-trips an open task under the tasks tab', () => {
    const view: MembersView = {
      type: 'user-detail',
      name: 'alice',
      tab: 'tasks',
      taskId: 'TASK-00170',
    };

    expect(viewToSubPath(view)).toBe('user/alice/tasks/TASK-00170');
    expect(hashSubPathToView('user/alice/tasks/TASK-00170')).toEqual(view);
  });

  it('falls back to overview for an unknown tab and ignores a stray task id', () => {
    expect(hashSubPathToView('users/alice/bogus/TASK-1')).toEqual({
      type: 'user-detail',
      name: 'alice',
      tab: 'overview',
    });
  });

  it('still routes users and users/create', () => {
    expect(hashSubPathToView('users')).toEqual({ type: 'users' });
    expect(hashSubPathToView('users/create')).toEqual({
      type: 'user-create',
      isAdmin: false,
    });
  });
});

describe('profile sub-path <-> user view', () => {
  it('round-trips another user with a tab and task', () => {
    const view = {
      type: 'user-detail' as const,
      name: 'a/b c',
      tab: 'tasks' as const,
      taskId: 'TASK-1',
    };
    const subPath = userViewToProfileSubPath(view);

    expect(subPath).toBe(`${encodeURIComponent('a/b c')}/tasks/TASK-1`);
    expect(profileSubPathToUserView(subPath)).toEqual(view);
  });

  it('defaults to overview and leaves an empty sub-path unresolved', () => {
    expect(profileSubPathToUserView('jane')).toEqual({
      type: 'user-detail',
      name: 'jane',
      tab: 'overview',
    });
    expect(profileSubPathToUserView('jane/custom-properties')?.tab).toBe(
      'custom-properties'
    );
    expect(profileSubPathToUserView('')).toBeUndefined();
  });
});

describe('legacy user/<name> links', () => {
  it('open the user detail overview, decoding the name', () => {
    expect(
      hashSubPathToView(`user/${encodeURIComponent('jane.doe@acme.io')}`)
    ).toEqual({
      type: 'user-detail',
      name: 'jane.doe@acme.io',
      tab: 'overview',
    });
  });

  it('reach a user named "create", which users/create cannot', () => {
    expect(hashSubPathToView('user/create')).toEqual({
      type: 'user-detail',
      name: 'create',
      tab: 'overview',
    });
    expect(hashSubPathToView('user')).toEqual({ type: 'users' });
  });
});

describe('a user named "create"', () => {
  const view = {
    type: 'user-detail' as const,
    name: 'create',
    tab: 'tasks' as const,
    taskId: 'TASK-7',
  };

  it('round-trips through the Members hash instead of opening the create form', () => {
    const subPath = viewToSubPath(view);

    expect(subPath).toBe('user/create/tasks/TASK-7');
    expect(hashSubPathToView(subPath as string)).toEqual(view);
    expect(
      hashSubPathToView(
        viewToSubPath({ ...view, tab: 'overview', taskId: undefined }) as string
      )
    ).toEqual({ type: 'user-detail', name: 'create', tab: 'overview' });
  });

  it('round-trips through the Profile hash', () => {
    const subPath = userViewToProfileSubPath(view);

    expect(subPath).toBe('create/tasks/TASK-7');
    expect(profileSubPathToUserView(subPath)).toEqual(view);
  });
});

describe('getProfileUserDetailView', () => {
  it('is your own Profile for your plain name', () => {
    expect(getProfileUserDetailView('harsh', 'harsh')).toBeUndefined();
  });

  it('opens your own tab or task when the link names one', () => {
    expect(getProfileUserDetailView('harsh/tasks/TASK-00170', 'harsh')).toEqual(
      {
        type: 'user-detail',
        name: 'harsh',
        tab: 'tasks',
        taskId: 'TASK-00170',
      }
    );
    expect(getProfileUserDetailView('harsh/activity', 'harsh')?.tab).toBe(
      'activity'
    );
  });

  it('opens anyone else, and nothing for an empty sub-path', () => {
    expect(getProfileUserDetailView('jane', 'harsh')?.name).toBe('jane');
    expect(getProfileUserDetailView('', 'harsh')).toBeUndefined();
  });
});

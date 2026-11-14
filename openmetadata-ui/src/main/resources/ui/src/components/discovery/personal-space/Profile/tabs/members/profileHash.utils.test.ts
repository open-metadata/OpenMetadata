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
  hashSubPathToView,
  profileSubPathToUserView,
} from './membersRoute.utils';
import { profileHash, toHashLocation } from './profileHash.utils';

describe('profileHash', () => {
  it('builds the members user-detail target for a user, encoding the name', () => {
    expect(profileHash.user('john.doe@acme.io')).toEqual({
      tab: 'members',
      subPath: `user/${encodeURIComponent('john.doe@acme.io')}`,
    });
  });

  it('round-trips a user named "create" to that user, not the create form', () => {
    const { subPath } = profileHash.user('create');

    expect(subPath).toBe('user/create');
    expect(hashSubPathToView(subPath as string)).toEqual({
      type: 'user-detail',
      name: 'create',
      tab: 'overview',
    });

    const fallback = profileHash.user('create', false);

    expect(profileSubPathToUserView(fallback.subPath as string)?.name).toBe(
      'create'
    );
  });

  it('builds the access-control role detail target', () => {
    expect(profileHash.role('DataConsumer')).toEqual({
      tab: 'access-control',
      subPath: 'roles/DataConsumer',
    });
  });

  it('builds the access-control policy detail target', () => {
    expect(profileHash.policy('DataConsumerPolicy')).toEqual({
      tab: 'access-control',
      subPath: 'policies/DataConsumerPolicy',
    });
  });

  it('builds the members team detail target, encoding the fqn', () => {
    expect(profileHash.team('Engineering')).toEqual({
      tab: 'members',
      subPath: 'teams/Engineering',
    });
  });
});

describe('toHashLocation', () => {
  it('joins tab and sub-path into a Link hash location', () => {
    expect(
      toHashLocation({ tab: 'access-control', subPath: 'roles/Admin' })
    ).toEqual({ hash: 'access-control/roles/Admin' });
  });

  it('falls back to just the tab when there is no sub-path', () => {
    expect(toHashLocation({ tab: 'profile' })).toEqual({ hash: 'profile' });
  });

  it('sends a viewer who cannot browse users to the read-only profile', () => {
    expect(profileHash.user('alice', false)).toEqual({
      tab: 'profile',
      subPath: 'alice',
    });
  });
});

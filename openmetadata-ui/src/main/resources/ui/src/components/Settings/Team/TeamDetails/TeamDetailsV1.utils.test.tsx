/*
 *  Copyright 2024 Collate.
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

import { Team } from '../../../../generated/entity/teams/team';
import { getTabs } from './TeamDetailsV1.utils';
import { TeamsPageTab } from './team.interface';

describe('getTabs', () => {
  const baseTeam: Team = {
    id: 'test-id',
    name: 'test-team',
    fullyQualifiedName: 'test-team',
    href: '',
    users: [
      { id: 'u1', type: 'user', name: 'user1', href: '' },
      { id: 'u2', type: 'user', name: 'user2', href: '' },
    ],
    defaultRoles: [{ id: 'r1', type: 'role', name: 'role1', href: '' }],
    policies: [{ id: 'p1', type: 'policy', name: 'policy1', href: '' }],
  };

  it('should return teams, roles, and policies tabs for Organization', () => {
    const tabs = getTabs(baseTeam, false, true, 5, 10, false);
    const tabKeys = tabs.map((t) => t.key);

    expect(tabKeys).toEqual([
      TeamsPageTab.TEAMS,
      TeamsPageTab.ROLES,
      TeamsPageTab.POLICIES,
    ]);
  });

  it('should return users, assets, roles, and policies tabs for Group type', () => {
    const tabs = getTabs(baseTeam, true, false, 5, 10, false);
    const tabKeys = tabs.map((t) => t.key);

    expect(tabKeys).toEqual([
      TeamsPageTab.USERS,
      TeamsPageTab.ASSETS,
      TeamsPageTab.ROLES,
      TeamsPageTab.POLICIES,
    ]);
  });

  it('should return teams, users, assets, roles, and policies tabs for Department type', () => {
    const tabs = getTabs(baseTeam, false, false, 5, 10, false);
    const tabKeys = tabs.map((t) => t.key);

    expect(tabKeys).toEqual([
      TeamsPageTab.TEAMS,
      TeamsPageTab.USERS,
      TeamsPageTab.ASSETS,
      TeamsPageTab.ROLES,
      TeamsPageTab.POLICIES,
    ]);
  });

  it('should include correct asset count', () => {
    const tabs = getTabs(baseTeam, false, false, 5, 42, false);
    const assetsTab = tabs.find((t) => t.key === TeamsPageTab.ASSETS);

    expect(assetsTab?.count).toBe(42);
  });

  it('should include correct user count from team data', () => {
    const tabs = getTabs(baseTeam, true, false, 5, 10, false);
    const usersTab = tabs.find((t) => t.key === TeamsPageTab.USERS);

    expect(usersTab?.count).toBe(2);
  });

  it('should include correct team count', () => {
    const tabs = getTabs(baseTeam, false, false, 7, 10, false);
    const teamsTab = tabs.find((t) => t.key === TeamsPageTab.TEAMS);

    expect(teamsTab?.count).toBe(7);
  });
});

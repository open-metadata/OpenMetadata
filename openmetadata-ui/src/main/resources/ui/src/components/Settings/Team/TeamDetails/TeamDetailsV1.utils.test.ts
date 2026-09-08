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
import { TeamsPageTab } from './team.interface';
import { getTabs } from './TeamDetailsV1.utils';

const getUsersTabCount = (team: Team, isGroupType: boolean) =>
  getTabs(team, isGroupType, false, 0, 0, false).find(
    (tab) => tab.key === TeamsPageTab.USERS
  )?.count;

describe('TeamDetailsV1.utils getTabs', () => {
  it('uses userCount (the subtree rollup) for the Users tab count', () => {
    // A non-Group team has no direct users but userCount reflects the sub-group rollup.
    const team = { userCount: 5, users: [] } as unknown as Team;

    expect(getUsersTabCount(team, false)).toBe(5);
  });

  it('falls back to the direct users length when userCount is missing', () => {
    const team = {
      users: [{ id: 'a' }, { id: 'b' }],
    } as unknown as Team;

    expect(getUsersTabCount(team, true)).toBe(2);
  });
});

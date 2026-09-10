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
  TeamHierarchy,
  TeamType,
} from '../../../../generated/entity/teams/teamHierarchy';
import { buildTeamsSelectableTree } from './TeamsSelectable.utils';

const groupTeam = (id: string, isJoinable = true): TeamHierarchy => ({
  id,
  name: id,
  displayName: id,
  teamType: TeamType.Group,
  isJoinable,
});

describe('buildTeamsSelectableTree', () => {
  it('should mark Group teams as selectable', () => {
    const tree = buildTeamsSelectableTree([groupTeam('group-1')]);

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      value: 'group-1',
      selectable: true,
      disabled: false,
    });
  });

  it('should prune non-Group teams without nested Group teams', () => {
    const tree = buildTeamsSelectableTree([
      {
        id: 'department-1',
        name: 'department-1',
        teamType: TeamType.Department,
      },
      {
        id: 'division-1',
        name: 'division-1',
        teamType: TeamType.Division,
        children: [
          {
            id: 'department-2',
            name: 'department-2',
            teamType: TeamType.Department,
          },
        ],
      },
    ]);

    expect(tree).toHaveLength(0);
  });

  it('should keep non-Group branches leading to Group teams as non-selectable', () => {
    const tree = buildTeamsSelectableTree([
      {
        id: 'division-1',
        name: 'division-1',
        teamType: TeamType.Division,
        children: [
          {
            id: 'department-1',
            name: 'department-1',
            teamType: TeamType.Department,
            children: [groupTeam('group-1')],
          },
          {
            id: 'department-2',
            name: 'department-2',
            teamType: TeamType.Department,
          },
        ],
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].selectable).toBe(false);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children?.[0]).toMatchObject({
      value: 'department-1',
      selectable: false,
    });
    expect(tree[0].children?.[0].children?.[0]).toMatchObject({
      value: 'group-1',
      selectable: true,
    });
  });

  it('should disable non-joinable teams when filterJoinable is set', () => {
    const tree = buildTeamsSelectableTree(
      [groupTeam('group-1', false), groupTeam('group-2')],
      true
    );

    expect(tree[0]).toMatchObject({ value: 'group-1', disabled: true });
    expect(tree[1]).toMatchObject({ value: 'group-2', disabled: false });
  });
});

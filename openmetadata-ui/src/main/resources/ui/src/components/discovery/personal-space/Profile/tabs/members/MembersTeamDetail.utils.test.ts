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
import { Team } from '../../../../../../generated/entity/teams/team';
import {
  updateTeamsHierarchy,
  withTeamChildrenPlaceholder,
} from './MembersTeamDetail.utils';

const team = (fqn: string, childrenCount = 0): Team =>
  ({ name: fqn, fullyQualifiedName: fqn, childrenCount } as Team);

describe('withTeamChildrenPlaceholder', () => {
  it('adds an empty children array to teams that have sub-teams', () => {
    const [withKids, leaf] = withTeamChildrenPlaceholder([
      team('a', 2),
      team('b', 0),
    ]);

    expect(withKids.children).toEqual([]);
    expect(leaf.children).toBeUndefined();
  });
});

describe('updateTeamsHierarchy', () => {
  it('grafts children onto the matching parent at any depth', () => {
    const tree = withTeamChildrenPlaceholder([team('a', 1)]);
    (tree[0].children as unknown as Team[]) = withTeamChildrenPlaceholder([
      team('a.b', 1),
    ]);

    updateTeamsHierarchy(tree, 'a.b', [team('a.b.c')]);

    const child = tree[0].children?.[0] as unknown as Team;

    expect(child.children?.[0].fullyQualifiedName).toBe('a.b.c');
  });

  it('leaves the tree untouched when the parent is absent', () => {
    const tree = withTeamChildrenPlaceholder([team('a', 1)]);

    updateTeamsHierarchy(tree, 'missing', [team('x')]);

    expect(tree[0].children).toEqual([]);
  });
});

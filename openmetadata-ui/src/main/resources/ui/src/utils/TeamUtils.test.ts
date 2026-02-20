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

import { Team, TeamType } from '../generated/entity/teams/team';
import { flattenTeamTree, isDropRestricted } from './TeamUtils';

const makeTeam = (id: string, children?: Team[]): Team =>
  ({
    id,
    name: id,
    children: children as unknown as Team['children'],
  } as Team);

describe('flattenTeamTree', () => {
  it('returns an empty array for empty input', () => {
    expect(flattenTeamTree([])).toEqual([]);
  });

  it('returns leaf teams as-is when they have no children', () => {
    const teams = [makeTeam('a'), makeTeam('b')];

    expect(flattenTeamTree(teams).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('flattens a single level of children', () => {
    const child1 = makeTeam('child1');
    const child2 = makeTeam('child2');
    const parent = makeTeam('parent', [child1, child2]);

    expect(flattenTeamTree([parent]).map((t) => t.id)).toEqual([
      'parent',
      'child1',
      'child2',
    ]);
  });

  it('flattens multiple levels of nesting depth-first', () => {
    const grandchild = makeTeam('grandchild');
    const child = makeTeam('child', [grandchild]);
    const parent = makeTeam('parent', [child]);

    expect(flattenTeamTree([parent]).map((t) => t.id)).toEqual([
      'parent',
      'child',
      'grandchild',
    ]);
  });

  it('handles trees with mixed leaf and non-leaf siblings', () => {
    const child = makeTeam('child');
    const bu1 = makeTeam('bu1', [child]);
    const bu2 = makeTeam('bu2');

    expect(flattenTeamTree([bu1, bu2]).map((t) => t.id)).toEqual([
      'bu1',
      'child',
      'bu2',
    ]);
  });

  it('treats undefined children the same as no children', () => {
    const team = makeTeam('a');
    (team as unknown as Record<string, unknown>).children = undefined;

    expect(flattenTeamTree([team]).map((t) => t.id)).toEqual(['a']);
  });
});

describe('isDropRestricted', () => {
  it('should be droppable if on drop team is BusinessUnit', () => {
    const groupDragResult = isDropRestricted(
      TeamType.Group,
      TeamType.BusinessUnit
    );

    expect(groupDragResult).toBe(false);

    const departmentDragResult = isDropRestricted(
      TeamType.Department,
      TeamType.BusinessUnit
    );

    expect(departmentDragResult).toBe(false);

    const divisionDragResult = isDropRestricted(
      TeamType.Division,
      TeamType.BusinessUnit
    );

    expect(divisionDragResult).toBe(false);
  });

  it('should not be droppable if on drop team team is Group', () => {
    const businessUnitDragResult = isDropRestricted(
      TeamType.BusinessUnit,
      TeamType.Group
    );

    expect(businessUnitDragResult).toBe(true);

    const departmentDragResult = isDropRestricted(
      TeamType.Department,
      TeamType.Group
    );

    expect(departmentDragResult).toBe(true);

    const divisionDragResult = isDropRestricted(
      TeamType.Division,
      TeamType.Group
    );

    expect(divisionDragResult).toBe(true);
  });

  // For Division TeamType
  it('should not be droppable if on drop team is Division', () => {
    const businessUnitDragResult = isDropRestricted(
      TeamType.BusinessUnit,
      TeamType.Division
    );

    expect(businessUnitDragResult).toBe(true);
  });

  it('should be droppable if on drop team is Division', () => {
    const departmentDragResult = isDropRestricted(
      TeamType.Department,
      TeamType.Division
    );

    expect(departmentDragResult).toBe(false);

    const groupDragResult = isDropRestricted(TeamType.Group, TeamType.Division);

    expect(groupDragResult).toBe(false);
  });

  // For Department TeamType
  it('should not be droppable if on drop team is Department', () => {
    const businessUnitDragResult = isDropRestricted(
      TeamType.BusinessUnit,
      TeamType.Department
    );

    expect(businessUnitDragResult).toBe(true);

    const divisionDragResult = isDropRestricted(
      TeamType.Division,
      TeamType.Department
    );

    expect(divisionDragResult).toBe(true);
  });

  it('should be droppable if on drop team is Department', () => {
    const groupDragResult = isDropRestricted(
      TeamType.Group,
      TeamType.Department
    );

    expect(groupDragResult).toBe(false);
  });
});

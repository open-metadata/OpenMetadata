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

import { TeamType } from '../generated/entity/teams/team';
import { MOCK_CHILD_TEAMS } from '../mocks/Teams.mock';
import { filterChildTeams, isDropRestricted } from './TeamUtils';

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

describe('filterChildTeams', () => {
  it('should return deleted terms if show deleted is true', () => {
    const filterTerms = filterChildTeams(MOCK_CHILD_TEAMS, true);

    expect(filterTerms).toEqual([MOCK_CHILD_TEAMS[2]]);
  });

  it('should return non-deleted terms if show deleted is false', () => {
    const filterTerms = filterChildTeams(MOCK_CHILD_TEAMS, false);

    expect(filterTerms).toEqual([
      MOCK_CHILD_TEAMS[3],
      MOCK_CHILD_TEAMS[0],
      MOCK_CHILD_TEAMS[1],
    ]);
  });

  it('should return deleted terms in sorted manner', () => {
    const filterTerms = filterChildTeams(MOCK_CHILD_TEAMS, false);

    expect(filterTerms).toEqual([
      MOCK_CHILD_TEAMS[3],
      MOCK_CHILD_TEAMS[0],
      MOCK_CHILD_TEAMS[1],
    ]);
  });
});

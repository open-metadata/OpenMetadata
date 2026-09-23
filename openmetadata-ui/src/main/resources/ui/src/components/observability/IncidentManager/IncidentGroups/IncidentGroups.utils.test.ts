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
  IncidentGroupBy,
  IncidentTrendDirection,
  TestCaseIncidentGroup,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { DEFAULT_INCIDENT_GROUP_BY } from './IncidentGroups.constants';
import {
  countRecurringIncidentGroups,
  getAssigneeInitials,
  getIncidentGroupAssignees,
  getIncidentGroupByOption,
  getIncidentGroupName,
  getIncidentGroupStatusSegments,
  getIncidentGroupSubLine,
  isUnownedIncidentGroup,
  parseIncidentGroupBy,
} from './IncidentGroups.utils';

const group = (
  overrides: Partial<TestCaseIncidentGroup> = {}
): TestCaseIncidentGroup => ({
  groupBy: IncidentGroupBy.TestDefinition,
  name: 'columnValuesToBeUnique',
  incidentCount: 3,
  ...overrides,
});

describe('parseIncidentGroupBy', () => {
  it('should keep every dimension the API accepts', () => {
    expect(parseIncidentGroupBy('table')).toBe(IncidentGroupBy.Table);
    expect(parseIncidentGroupBy('testDefinition')).toBe(
      IncidentGroupBy.TestDefinition
    );
    expect(parseIncidentGroupBy('owner')).toBe(IncidentGroupBy.Owner);
  });

  it('should fall back to the default dimension for an unusable value', () => {
    expect(parseIncidentGroupBy(undefined)).toBe(DEFAULT_INCIDENT_GROUP_BY);
    expect(parseIncidentGroupBy('')).toBe(DEFAULT_INCIDENT_GROUP_BY);
    expect(parseIncidentGroupBy('Table')).toBe(DEFAULT_INCIDENT_GROUP_BY);
    expect(parseIncidentGroupBy(['table', 'owner'])).toBe(
      DEFAULT_INCIDENT_GROUP_BY
    );
  });
});

describe('getIncidentGroupByOption', () => {
  it('should carry the label of the dimension the groups were fetched with', () => {
    expect(getIncidentGroupByOption(IncidentGroupBy.Table).labelKey).toBe(
      'label.table'
    );
    expect(getIncidentGroupByOption(IncidentGroupBy.Owner).labelKey).toBe(
      'label.test-case-owner'
    );
    expect(
      getIncidentGroupByOption(IncidentGroupBy.TestDefinition).labelKey
    ).toBe('label.test-case-type');
  });
});

describe('getIncidentGroupName', () => {
  it('should prefer the display name and fall back to the name', () => {
    expect(getIncidentGroupName(group({ displayName: 'Row count' }))).toBe(
      'Row count'
    );
    expect(getIncidentGroupName(group())).toBe('columnValuesToBeUnique');
  });
});

describe('getIncidentGroupSubLine', () => {
  it('should place a table group under the rest of its FQN', () => {
    expect(
      getIncidentGroupSubLine(
        group({
          groupBy: IncidentGroupBy.Table,
          name: 'dim_address',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
        })
      )
    ).toBe('sample_data · ecommerce_db · shopify');
  });

  it('should keep a quoted FQN part whole', () => {
    expect(
      getIncidentGroupSubLine(
        group({
          groupBy: IncidentGroupBy.Table,
          name: 'dim_address',
          fullyQualifiedName: 'sample_data."ecommerce.db".shopify.dim_address',
        })
      )
    ).toBe('sample_data · ecommerce.db · shopify');
  });

  it('should leave a test definition and an owner without a sub-line', () => {
    expect(
      getIncidentGroupSubLine(
        group({ fullyQualifiedName: 'columnValuesToBeUnique' })
      )
    ).toBe('');
    expect(
      getIncidentGroupSubLine(
        group({
          groupBy: IncidentGroupBy.Owner,
          name: 'adam.matthews',
          fullyQualifiedName: 'adam.matthews',
        })
      )
    ).toBe('');
  });

  it('should return nothing when the group carries no FQN', () => {
    expect(getIncidentGroupSubLine(group())).toBe('');
  });
});

describe('isUnownedIncidentGroup', () => {
  it('should single out the owner group that resolved to no entity', () => {
    expect(
      isUnownedIncidentGroup(
        group({ groupBy: IncidentGroupBy.Owner, name: 'No Owner' })
      )
    ).toBe(true);
  });

  it('should leave a resolved owner and every other dimension alone', () => {
    expect(
      isUnownedIncidentGroup(
        group({
          groupBy: IncidentGroupBy.Owner,
          id: 'a3f6b0de-1a0e-4a2f-9f2e-8c6a9f1b2c3d',
          name: 'adam.matthews',
        })
      )
    ).toBe(false);
    expect(
      isUnownedIncidentGroup(group({ groupBy: IncidentGroupBy.Table }))
    ).toBe(false);
  });
});

describe('getIncidentGroupStatusSegments', () => {
  it('should size each status against the group and order them by triage', () => {
    expect(
      getIncidentGroupStatusSegments([
        { status: TestCaseResolutionStatusTypes.New, count: 1 },
        { status: TestCaseResolutionStatusTypes.Assigned, count: 2 },
        { status: TestCaseResolutionStatusTypes.ACK, count: 1 },
      ])
    ).toEqual([
      {
        status: TestCaseResolutionStatusTypes.Assigned,
        count: 2,
        share: 50,
      },
      { status: TestCaseResolutionStatusTypes.ACK, count: 1, share: 25 },
      { status: TestCaseResolutionStatusTypes.New, count: 1, share: 25 },
    ]);
  });

  it('should give a single status the whole bar', () => {
    expect(
      getIncidentGroupStatusSegments([
        { status: TestCaseResolutionStatusTypes.New, count: 3 },
      ])
    ).toEqual([
      { status: TestCaseResolutionStatusTypes.New, count: 3, share: 100 },
    ]);
  });

  it('should drop a status no incident is in', () => {
    expect(
      getIncidentGroupStatusSegments([
        { status: TestCaseResolutionStatusTypes.Assigned, count: 0 },
        { status: TestCaseResolutionStatusTypes.New, count: 2 },
      ])
    ).toEqual([
      { status: TestCaseResolutionStatusTypes.New, count: 2, share: 100 },
    ]);
  });

  it('should keep a resolved count out of the bar', () => {
    expect(
      getIncidentGroupStatusSegments([
        { status: TestCaseResolutionStatusTypes.Resolved, count: 4 },
        { status: TestCaseResolutionStatusTypes.New, count: 1 },
      ])
    ).toEqual([
      { status: TestCaseResolutionStatusTypes.New, count: 1, share: 100 },
    ]);
  });

  it('should report nothing when the group carries no counts', () => {
    expect(getIncidentGroupStatusSegments()).toEqual([]);
    expect(getIncidentGroupStatusSegments([])).toEqual([]);
  });
});

describe('getAssigneeInitials', () => {
  it('should take up to two initials from the assignee name', () => {
    expect(getAssigneeInitials('tomas.montiel')).toBe('TM');
    expect(getAssigneeInitials('mohit')).toBe('M');
    expect(getAssigneeInitials('paul_james_jones')).toBe('PJ');
    expect(getAssigneeInitials('')).toBe('');
  });
});

describe('getIncidentGroupAssignees', () => {
  it('should count the overflow from assigneeCount, not from the capped array', () => {
    expect(
      getIncidentGroupAssignees(
        group({ assignees: ['a', 'b', 'c'], assigneeCount: 7 })
      )
    ).toEqual({ visible: ['a', 'b', 'c'], overflowCount: 4 });
  });

  it('should show no more than three avatars', () => {
    expect(
      getIncidentGroupAssignees(
        group({ assignees: ['a', 'b', 'c', 'd'], assigneeCount: 4 })
      )
    ).toEqual({ visible: ['a', 'b', 'c'], overflowCount: 1 });
  });

  it('should fall back to the array length when the count is absent', () => {
    expect(getIncidentGroupAssignees(group({ assignees: ['a'] }))).toEqual({
      visible: ['a'],
      overflowCount: 0,
    });
  });

  it('should report nothing for an unassigned group', () => {
    expect(getIncidentGroupAssignees(group())).toEqual({
      visible: [],
      overflowCount: 0,
    });
  });
});

describe('countRecurringIncidentGroups', () => {
  it('should count only the rising groups of the loaded page', () => {
    expect(
      countRecurringIncidentGroups([
        group({ trendDirection: IncidentTrendDirection.Rising }),
        group({ trendDirection: IncidentTrendDirection.Rising }),
        group({ trendDirection: IncidentTrendDirection.Falling }),
        group({ trendDirection: IncidentTrendDirection.Steady }),
        group(),
      ])
    ).toBe(2);
  });

  it('should count nothing for an empty page', () => {
    expect(countRecurringIncidentGroups([])).toBe(0);
  });
});

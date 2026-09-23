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
  Severities,
  TestCaseIncidentGroup,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import {
  DEFAULT_INCIDENT_GROUP_BY,
  INCIDENT_TREND_COLORS,
  SPARKLINE_HEIGHT,
  SPARKLINE_INSET,
  SPARKLINE_WIDTH,
} from './IncidentGroups.constants';
import {
  countRecurringIncidentGroups,
  getIncidentGroupAssignees,
  getIncidentGroupByOption,
  getIncidentGroupStatusSegments,
  getIncidentGroupSubLine,
  getIncidentTrendColor,
  getIncidentTrendPoints,
  isRecurring,
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
  // The server sends the counts most actionable first, with unoccupied
  // statuses and `Resolved` already left out, so sizing is all that is left.
  it('should size each status against the group, keeping the order it arrived in', () => {
    expect(
      getIncidentGroupStatusSegments([
        { status: TestCaseResolutionStatusTypes.Assigned, count: 2 },
        { status: TestCaseResolutionStatusTypes.ACK, count: 1 },
        { status: TestCaseResolutionStatusTypes.New, count: 1 },
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

  it('should report nothing when the group carries no counts', () => {
    expect(getIncidentGroupStatusSegments()).toEqual([]);
    expect(getIncidentGroupStatusSegments([])).toEqual([]);
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

describe('getIncidentTrendPoints', () => {
  it('should spread the buckets across the width and scale them to the peak', () => {
    const points = getIncidentTrendPoints([0, 1, 2, 3, 4, 3, 2, 4]).split(' ');

    expect(points).toHaveLength(8);
    // First bucket is 0 — it sits on the floor, inset from the bottom edge.
    expect(points[0]).toBe(
      `${SPARKLINE_INSET},${SPARKLINE_HEIGHT - SPARKLINE_INSET}`
    );
    // Last bucket ties the peak, so it sits on the ceiling at the right edge.
    expect(points[7]).toBe(
      `${SPARKLINE_WIDTH - SPARKLINE_INSET},${SPARKLINE_INSET}`
    );
  });

  it('should scale against the peak, not against an absolute volume', () => {
    // Same shape at two volumes must draw the same line.
    expect(getIncidentTrendPoints([1, 2, 4])).toBe(
      getIncidentTrendPoints([10, 20, 40])
    );
  });

  it('should draw an all-zero trend flat through the middle', () => {
    const points = getIncidentTrendPoints([0, 0, 0, 0]).split(' ');
    const midY = SPARKLINE_INSET + (SPARKLINE_HEIGHT - SPARKLINE_INSET * 2) / 2;

    points.forEach((point) => expect(point.split(',')[1]).toBe(`${midY}`));
  });

  it('should place a single bucket at the left edge', () => {
    expect(getIncidentTrendPoints([4])).toBe(
      `${SPARKLINE_INSET},${SPARKLINE_INSET}`
    );
  });
});

describe('getIncidentTrendColor', () => {
  it.each([
    [
      IncidentTrendDirection.Rising,
      Severities.Severity1,
      INCIDENT_TREND_COLORS.error,
    ],
    [
      IncidentTrendDirection.Rising,
      Severities.Severity3,
      INCIDENT_TREND_COLORS.warning,
    ],
    [IncidentTrendDirection.Rising, undefined, INCIDENT_TREND_COLORS.warning],
    [
      IncidentTrendDirection.Falling,
      Severities.Severity1,
      INCIDENT_TREND_COLORS.success,
    ],
    [IncidentTrendDirection.Falling, undefined, INCIDENT_TREND_COLORS.success],
    [
      IncidentTrendDirection.Steady,
      Severities.Severity1,
      INCIDENT_TREND_COLORS.neutral,
    ],
    [IncidentTrendDirection.Steady, undefined, INCIDENT_TREND_COLORS.neutral],
    [undefined, Severities.Severity1, INCIDENT_TREND_COLORS.neutral],
  ])(
    'should colour %s / %s with the matching token',
    (direction, severity, expected) => {
      expect(getIncidentTrendColor(direction, severity)).toBe(expected);
    }
  );
});

describe('isRecurring', () => {
  it('should treat a rising group as recurring', () => {
    expect(
      isRecurring(group({ trendDirection: IncidentTrendDirection.Rising }))
    ).toBe(true);
  });

  it('should not treat a falling, steady or trendless group as recurring', () => {
    expect(
      isRecurring(group({ trendDirection: IncidentTrendDirection.Falling }))
    ).toBe(false);
    expect(
      isRecurring(group({ trendDirection: IncidentTrendDirection.Steady }))
    ).toBe(false);
    expect(isRecurring(group())).toBe(false);
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

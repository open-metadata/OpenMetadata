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
import { TestCaseResolutionStatusTypes as ResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import {
  DEFAULT_INCIDENT_GROUP_BY,
  INCIDENT_TREND_COLORS,
  SPARKLINE_HEIGHT,
  SPARKLINE_INSET,
  SPARKLINE_WIDTH,
} from './IncidentGroups.constants';
import {
  countRecurringIncidentGroups,
  getIncidentGroupByOption,
  getIncidentGroupSortQuery,
  getIncidentGroupsQuery,
  getIncidentGroupStatusSegments,
  getIncidentGroupSubLine,
  getIncidentGroupSubLineTitle,
  getIncidentTrendColor,
  getIncidentTrendPoints,
  getPageAfterEmptyRead,
  isRecurring,
  isUnownedIncidentGroup,
  parseIncidentGroupBy,
  parseIncidentGroupFilters,
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
  const tables = [
    { id: 't1', type: 'table', name: 'customers' },
    { id: 't2', type: 'table', name: 'orders', displayName: 'Orders' },
  ];
  const testDefinitions = [
    {
      id: 'd1',
      type: 'testDefinition',
      name: 'rowCount',
      displayName: 'Row count',
    },
    { id: 'd2', type: 'testDefinition', name: 'uniqueness' },
  ];

  it('should list the tables of a test definition group', () => {
    expect(getIncidentGroupSubLine(group({ tables, testDefinitions }))).toBe(
      'customers · Orders'
    );
  });

  it('should list the test definitions of a table group', () => {
    expect(
      getIncidentGroupSubLine(
        group({ groupBy: IncidentGroupBy.Table, tables, testDefinitions })
      )
    ).toBe('Row count · uniqueness');
  });

  it('should list the tables of an owner group', () => {
    expect(
      getIncidentGroupSubLine(
        group({ groupBy: IncidentGroupBy.Owner, tables, testDefinitions })
      )
    ).toBe('customers · Orders');
  });

  it('should return nothing when the group names no related entity', () => {
    expect(getIncidentGroupSubLine(group())).toBe('');
  });
});

describe('getIncidentGroupSubLineTitle', () => {
  it('should tell same-named tables apart by their FQN, one per line', () => {
    expect(
      getIncidentGroupSubLineTitle(
        group({
          tables: [
            {
              id: 't1',
              type: 'table',
              name: 'gl_fx_rates',
              fullyQualifiedName: 'warehouse.fin.gl.gl_fx_rates',
            },
            {
              id: 't2',
              type: 'table',
              name: 'gl_fx_rates',
              fullyQualifiedName: 'warehouse_eu.fin.gl.gl_fx_rates',
            },
            { id: 't3', type: 'table', name: 'orders' },
          ],
        })
      )
    ).toBe(
      'warehouse.fin.gl.gl_fx_rates\nwarehouse_eu.fin.gl.gl_fx_rates\norders'
    );
  });

  it('should return nothing when the group names no related entity', () => {
    expect(getIncidentGroupSubLineTitle(group())).toBe('');
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

describe('parseIncidentGroupFilters', () => {
  it('should read every filter the URL carries', () => {
    expect(
      parseIncidentGroupFilters({
        testCaseFQN: 'svc.db.schema.table.case',
        assignee: 'aaron',
        status: ['New', 'Ack'],
        dateField: 'updatedAt',
        startTs: '1700000000000',
        endTs: '1700086400000',
      })
    ).toEqual({
      testCaseFQN: 'svc.db.schema.table.case',
      assignee: 'aaron',
      status: [ResolutionStatusTypes.New, ResolutionStatusTypes.ACK],
      dateField: 'updatedAt',
      startTs: 1700000000000,
      endTs: 1700086400000,
    });
  });

  it('should default to no filter on an empty URL', () => {
    expect(parseIncidentGroupFilters({})).toEqual({
      status: [],
      dateField: 'timestamp',
    });
  });

  it('should accept a single status as well as a repeated one', () => {
    expect(parseIncidentGroupFilters({ status: 'Assigned' }).status).toEqual([
      ResolutionStatusTypes.Assigned,
    ]);
  });

  it('should drop statuses the groups endpoint rejects, and duplicates', () => {
    expect(
      parseIncidentGroupFilters({ status: ['Resolved', 'bogus', 'New', 'New'] })
        .status
    ).toEqual([ResolutionStatusTypes.New]);
  });

  it('should ignore empty, repeated or non-numeric values', () => {
    expect(
      parseIncidentGroupFilters({
        testCaseFQN: '',
        assignee: ['a', 'b'],
        dateField: 'bogus',
        startTs: 'yesterday',
        endTs: '',
      })
    ).toEqual({ status: [], dateField: 'timestamp' });
  });
});

describe('getIncidentGroupsQuery', () => {
  it('should send nothing for an unfiltered view', () => {
    expect(
      getIncidentGroupsQuery({ status: [], dateField: 'timestamp' })
    ).toEqual({});
  });

  it('should send the test case, assignee and repeatable status', () => {
    expect(
      getIncidentGroupsQuery({
        testCaseFQN: 'svc.db.schema.table.case',
        assignee: 'aaron',
        status: [ResolutionStatusTypes.New, ResolutionStatusTypes.Assigned],
        dateField: 'timestamp',
      })
    ).toEqual({
      testCaseFQN: 'svc.db.schema.table.case',
      assignee: 'aaron',
      status: [ResolutionStatusTypes.New, ResolutionStatusTypes.Assigned],
    });
  });

  it('should apply a range to the creation date by default', () => {
    expect(
      getIncidentGroupsQuery({
        status: [],
        dateField: 'timestamp',
        startTs: 1,
        endTs: 2,
      })
    ).toEqual({ dateField: 'createdAt', startTs: 1, endTs: 2 });
  });

  it('should apply a range to the last update when asked to', () => {
    expect(
      getIncidentGroupsQuery({
        status: [],
        dateField: 'updatedAt',
        startTs: 1,
        endTs: 2,
      })
    ).toEqual({ dateField: 'updatedAt', startTs: 1, endTs: 2 });
  });

  it('should leave the date field out when no range is set', () => {
    expect(
      getIncidentGroupsQuery({ status: [], dateField: 'updatedAt' })
    ).toEqual({});
  });
});

describe('getPageAfterEmptyRead', () => {
  it('should keep a page that has rows, and the first page even when empty', () => {
    expect(getPageAfterEmptyRead(3, 2, 10, 13)).toBeUndefined();
    expect(getPageAfterEmptyRead(0, 1, 10, 0)).toBeUndefined();
  });

  it('should step back to the last page the total still reaches', () => {
    expect(getPageAfterEmptyRead(0, 4, 10, 15)).toBe(2);
  });

  it('should step back at least one page when the total lags behind', () => {
    expect(getPageAfterEmptyRead(0, 3, 10, 30)).toBe(2);
  });

  it('should fall back to the first page when there is no total', () => {
    expect(getPageAfterEmptyRead(0, 3, 10)).toBe(1);
  });
});

describe('getIncidentGroupSortQuery', () => {
  it('should leave the default field out and keep the direction', () => {
    expect(
      getIncidentGroupSortQuery({ field: 'incidentCount', type: 'asc' })
    ).toEqual({ sortType: 'asc', sortField: undefined });
  });

  it('should send any other field', () => {
    expect(
      getIncidentGroupSortQuery({ field: 'severity', type: 'desc' })
    ).toEqual({ sortType: 'desc', sortField: 'severity' });
  });
});

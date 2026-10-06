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

import QueryString from 'qs';
import {
  IncidentGroupBy,
  IncidentTrendDirection,
  Severities,
  TestCaseIncidentGroup,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes as ResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { OpenIncidentStatus } from '../../../../rest/incidentManagerAPI';
import {
  DEFAULT_INCIDENT_GROUP_BY,
  INCIDENT_TREND_COLORS,
  SPARKLINE_HEIGHT,
  SPARKLINE_INSET,
  SPARKLINE_WIDTH,
} from './IncidentGroups.constants';
import {
  buildIncidentGroupsParams,
  countRecurringIncidentGroups,
  getIncidentGroupAssignees,
  getIncidentGroupByOption,
  getIncidentGroupsPageCount,
  getIncidentGroupStatusSegments,
  getIncidentGroupSubLine,
  getIncidentTrendColor,
  getIncidentTrendPoints,
  hasActiveIncidentGroupsFilters,
  isRecurring,
  isUnownedIncidentGroup,
  parseIncidentGroupBy,
  parseIncidentGroupsFilters,
  parseIncidentGroupsPaging,
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

describe('parseIncidentGroupsFilters', () => {
  it('should read every filter the groups endpoint takes', () => {
    expect(
      parseIncidentGroupsFilters(
        QueryString.parse(
          'testCaseFQN=svc.db.schema.orders.row_count&assignee=adam' +
            '&status=New&status=Ack&dateField=updatedAt&startTs=100&endTs=200'
        )
      )
    ).toEqual({
      testCaseFQN: 'svc.db.schema.orders.row_count',
      assignee: 'adam',
      status: [ResolutionStatusTypes.New, ResolutionStatusTypes.ACK],
      dateField: 'updatedAt',
      startTs: 100,
      endTs: 200,
    });
  });

  it('should read nothing from a URL without filters', () => {
    expect(parseIncidentGroupsFilters({ groupBy: 'table' })).toEqual({});
  });

  it('should drop the statuses the endpoint rejects', () => {
    expect(
      parseIncidentGroupsFilters(
        QueryString.parse('status=Resolved&status=Bogus&status=New&status=New')
      )
    ).toEqual({ status: [ResolutionStatusTypes.New] });
    expect(
      parseIncidentGroupsFilters(QueryString.parse('status=Resolved'))
    ).toEqual({});
  });

  it('should read the indexed array format other writers of the URL produce', () => {
    expect(
      parseIncidentGroupsFilters(
        QueryString.parse(
          QueryString.stringify({ status: ['Assigned', 'New'] })
        )
      ).status
    ).toEqual([ResolutionStatusTypes.Assigned, ResolutionStatusTypes.New]);
  });

  it('should leave out a date field the endpoint does not take', () => {
    // `timestamp` is what the flat listing writes for creation time.
    expect(parseIncidentGroupsFilters({ dateField: 'timestamp' })).toEqual({});
    expect(parseIncidentGroupsFilters({ dateField: 'createdAt' })).toEqual({
      dateField: 'createdAt',
    });
  });

  it('should ignore malformed values rather than send them', () => {
    expect(
      parseIncidentGroupsFilters({
        testCaseFQN: '',
        assignee: ['adam', 'eve'],
        startTs: 'yesterday',
        endTs: '-5',
      })
    ).toEqual({});
  });
});

describe('parseIncidentGroupsPaging', () => {
  it('should open on the first page at the default size', () => {
    expect(parseIncidentGroupsPaging({})).toEqual({ page: 1, pageSize: 10 });
  });

  it('should keep the cursor verbatim for a later page', () => {
    expect(
      parseIncidentGroupsPaging({
        page: '3',
        cursor: 'eyJvZmZzZXQiOjIwfQ==',
        pageSize: '25',
      })
    ).toEqual({ page: 3, pageSize: 25, cursor: 'eyJvZmZzZXQiOjIwfQ==' });
  });

  it('should land on the first page when the page and cursor do not go together', () => {
    expect(parseIncidentGroupsPaging({ page: '3' })).toEqual({
      page: 1,
      pageSize: 10,
    });
    expect(parseIncidentGroupsPaging({ cursor: 'abc' })).toEqual({
      page: 1,
      pageSize: 10,
    });
    expect(parseIncidentGroupsPaging({ page: '1', cursor: 'abc' })).toEqual({
      page: 1,
      pageSize: 10,
    });
  });

  it('should fall back to the default size for one the pager does not offer', () => {
    expect(parseIncidentGroupsPaging({ pageSize: '7' }).pageSize).toBe(10);
    expect(parseIncidentGroupsPaging({ pageSize: '5000' }).pageSize).toBe(10);
  });
});

/** Typed up front: an inline enum array widens to every status, `Resolved` included. */
const NEW_ONLY: OpenIncidentStatus[] = [ResolutionStatusTypes.New];

describe('buildIncidentGroupsParams', () => {
  const firstPage = { page: 1, pageSize: 10 };

  it('should send only the dimension, size and order when nothing is filtered', () => {
    expect(
      buildIncidentGroupsParams({
        groupBy: IncidentGroupBy.Table,
        filters: {},
        paging: firstPage,
        sortType: 'desc',
      })
    ).toEqual({ groupBy: IncidentGroupBy.Table, limit: 10, sortType: 'desc' });
  });

  it.each([
    ['testCaseFQN', { testCaseFQN: 'svc.db.schema.orders.row_count' }],
    ['assignee', { assignee: 'adam' }],
    ['status', { status: NEW_ONLY }],
    ['dateField', { dateField: 'updatedAt' as const }],
    ['startTs/endTs', { startTs: 100, endTs: 200 }],
  ])('should map the %s filter onto its API param', (_name, filter) => {
    expect(
      buildIncidentGroupsParams({
        groupBy: IncidentGroupBy.Owner,
        filters: filter,
        paging: firstPage,
        sortType: 'desc',
      })
    ).toEqual({
      groupBy: IncidentGroupBy.Owner,
      limit: 10,
      sortType: 'desc',
      ...filter,
    });
  });

  it('should compose every active filter with the pager into one request', () => {
    expect(
      buildIncidentGroupsParams({
        groupBy: IncidentGroupBy.TestDefinition,
        filters: {
          testCaseFQN: 'fqn',
          assignee: 'adam',
          status: [ResolutionStatusTypes.ACK, ResolutionStatusTypes.Assigned],
          dateField: 'createdAt',
          startTs: 1,
          endTs: 2,
        },
        paging: { page: 4, pageSize: 25, cursor: 'opaque==' },
        sortType: 'asc',
      })
    ).toEqual({
      groupBy: IncidentGroupBy.TestDefinition,
      testCaseFQN: 'fqn',
      assignee: 'adam',
      status: [ResolutionStatusTypes.ACK, ResolutionStatusTypes.Assigned],
      dateField: 'createdAt',
      startTs: 1,
      endTs: 2,
      limit: 25,
      offset: 'opaque==',
      sortType: 'asc',
    });
  });
});

describe('hasActiveIncidentGroupsFilters', () => {
  it.each([
    [{ testCaseFQN: 'fqn' }],
    [{ assignee: 'adam' }],
    [{ status: NEW_ONLY }],
    [{ startTs: 0 }],
    [{ endTs: 5 }],
  ])('should count %j as narrowing the groups', (filters) => {
    expect(hasActiveIncidentGroupsFilters(filters)).toBe(true);
  });

  it('should not count the date field on its own', () => {
    expect(hasActiveIncidentGroupsFilters({})).toBe(false);
    expect(hasActiveIncidentGroupsFilters({ dateField: 'updatedAt' })).toBe(
      false
    );
    expect(hasActiveIncidentGroupsFilters({ status: [] })).toBe(false);
  });
});

describe('getIncidentGroupsPageCount', () => {
  it('should size the pager from the total', () => {
    expect(getIncidentGroupsPageCount(1, 10, { total: 25 })).toBe(3);
    expect(getIncidentGroupsPageCount(1, 25, { total: 25 })).toBe(1);
  });

  it('should offer one page when there is nothing to page through', () => {
    expect(getIncidentGroupsPageCount(1, 10, { total: 0 })).toBe(1);
    expect(getIncidentGroupsPageCount(1, 10)).toBe(1);
  });

  it('should keep the next page reachable while the server has one', () => {
    expect(
      getIncidentGroupsPageCount(3, 10, { total: 20, after: 'more' })
    ).toBe(4);
  });

  it('should never offer fewer pages than the one being shown', () => {
    expect(getIncidentGroupsPageCount(5, 10, { total: 20 })).toBe(5);
  });
});

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
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { getIncidentGroupIncidentsQuery } from './IncidentGroupIncidents.utils';
import { IncidentGroupFilters } from './IncidentGroups.types';

const NOW = 1_790_000_000_000;
const NO_FILTERS: IncidentGroupFilters = {
  status: [],
  severity: [],
  dateField: 'timestamp',
};

const group = (
  overrides: Partial<TestCaseIncidentGroup> = {}
): TestCaseIncidentGroup => ({
  groupBy: IncidentGroupBy.TestDefinition,
  id: '5f0c2a64-2b56-4c3d-9a7b-9f1e1f2c3d4e',
  name: 'tableRowCountToEqual',
  fullyQualifiedName: 'tableRowCountToEqual',
  incidentCount: 4,
  ...overrides,
});

describe('getIncidentGroupIncidentsQuery', () => {
  it('should list the latest record of every open incident of a test definition', () => {
    expect(getIncidentGroupIncidentsQuery(group(), NO_FILTERS, NOW)).toEqual({
      testDefinition: 'tableRowCountToEqual',
      latest: true,
      startTs: 0,
      endTs: NOW,
      testCaseResolutionStatusType: 'New,Ack,Assigned',
    });
  });

  it('should scope a table group to the incidents raised on it', () => {
    expect(
      getIncidentGroupIncidentsQuery(
        group({
          groupBy: IncidentGroupBy.Table,
          name: 'orders',
          fullyQualifiedName: 'svc.db.shop.orders',
        }),
        NO_FILTERS,
        NOW
      )
    ).toEqual(
      expect.objectContaining({ originEntityFQN: 'svc.db.shop.orders' })
    );
  });

  it('should scope an owner group to the test cases its owner owns', () => {
    expect(
      getIncidentGroupIncidentsQuery(
        group({
          groupBy: IncidentGroupBy.Owner,
          name: 'aaron',
          fullyQualifiedName: 'aaron',
        }),
        NO_FILTERS,
        NOW
      )
    ).toEqual(expect.objectContaining({ owner: 'aaron' }));
  });

  it('should list the unowned test cases for the owner bucket of no entity', () => {
    const query = getIncidentGroupIncidentsQuery(
      group({
        groupBy: IncidentGroupBy.Owner,
        id: undefined,
        name: 'No Owner',
        fullyQualifiedName: undefined,
      }),
      NO_FILTERS,
      NOW
    );

    expect(query).toEqual(expect.objectContaining({ unowned: true }));
    expect(query.owner).toBeUndefined();
  });

  it('should fall back to the name of a group without an FQN', () => {
    expect(
      getIncidentGroupIncidentsQuery(
        group({ fullyQualifiedName: undefined }),
        NO_FILTERS,
        NOW
      )
    ).toEqual(
      expect.objectContaining({ testDefinition: 'tableRowCountToEqual' })
    );
  });

  it('should carry the page filters so the list matches the group count', () => {
    expect(
      getIncidentGroupIncidentsQuery(
        group(),
        {
          testCaseFQN: 'svc.db.shop.orders.row_count',
          assignee: 'aaron',
          status: [TestCaseResolutionStatusTypes.ACK],
          severity: ['Severity2', 'none'],
          dateField: 'updatedAt',
          startTs: 10,
          endTs: 20,
        },
        NOW,
        'Marketing'
      )
    ).toEqual({
      testDefinition: 'tableRowCountToEqual',
      latest: true,
      startTs: 10,
      endTs: 20,
      dateField: 'updatedAt',
      testCaseResolutionStatusType: 'Ack',
      testCaseFQN: 'svc.db.shop.orders.row_count',
      assignee: 'aaron',
      severity: 'Severity2,none',
      domain: 'Marketing',
    });
  });

  it('should apply a range to the opening time by default', () => {
    expect(
      getIncidentGroupIncidentsQuery(
        group(),
        { ...NO_FILTERS, startTs: 10, endTs: 20 },
        NOW
      )
    ).toEqual(
      expect.objectContaining({
        dateField: 'createdAt',
        startTs: 10,
        endTs: 20,
      })
    );
  });
});

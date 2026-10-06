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
  Severities as CreateSeverities,
  TestCaseFailureReasonType,
  TestCaseResolutionStatusTypes as CreateStatusTypes,
} from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import {
  buildBulkIncidentEntries,
  chunkBulkIncidentEntries,
  mergeBulkResults,
  toBulkStatusDetails,
} from './IncidentGroupBulk.utils';

const aaron = { id: 'user-a', type: 'user', name: 'aaron' };
const bea = { id: 'user-b', type: 'user', name: 'bea' };

const incident = (
  name: string,
  overrides: Partial<TestCaseResolutionStatus> = {}
): TestCaseResolutionStatus => ({
  stateId: `state-${name}`,
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
  testCaseReference: {
    id: `case-${name}`,
    type: 'testCase',
    name,
    fullyQualifiedName: `svc.db.shop.orders.${name}`,
  },
  ...overrides,
});

const fresh = incident('fresh');
const acked = incident('acked', {
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
  severity: Severities.Severity2,
});
const assignedToAaron = incident('assigned', {
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
  testCaseResolutionStatusDetails: { assignee: aaron },
  severity: Severities.Severity1,
});

describe('buildBulkIncidentEntries', () => {
  it('should move every incident not already there to the new status', () => {
    expect(
      buildBulkIncidentEntries([fresh, acked, assignedToAaron], {
        kind: 'status',
        status: CreateStatusTypes.Resolved,
      })
    ).toEqual({
      entries: [fresh, acked, assignedToAaron].map((incident) => ({
        testCaseReference: incident.testCaseReference?.fullyQualifiedName,
        testCaseResolutionStatusType: CreateStatusTypes.Resolved,
        testCaseResolutionStatusDetails: undefined,
      })),
      unchanged: 0,
    });
  });

  it('should acknowledge only the incidents still new', () => {
    expect(
      buildBulkIncidentEntries([fresh, acked, assignedToAaron], {
        kind: 'status',
        status: CreateStatusTypes.ACK,
      })
    ).toEqual({
      entries: [
        {
          testCaseReference: 'svc.db.shop.orders.fresh',
          testCaseResolutionStatusType: CreateStatusTypes.ACK,
          testCaseResolutionStatusDetails: undefined,
        },
      ],
      unchanged: 2,
    });
  });

  it('should leave out assigned incidents, which the workflow cannot acknowledge', () => {
    expect(
      buildBulkIncidentEntries([assignedToAaron], {
        kind: 'status',
        status: CreateStatusTypes.ACK,
      })
    ).toEqual({ entries: [], unchanged: 1 });
  });

  it('should carry the assignee, and skip incidents already assigned to them', () => {
    const { entries, unchanged } = buildBulkIncidentEntries(
      [fresh, assignedToAaron],
      {
        kind: 'status',
        status: CreateStatusTypes.Assigned,
        details: { assignee: aaron },
      }
    );

    expect(unchanged).toBe(1);
    expect(entries).toEqual([
      {
        testCaseReference: 'svc.db.shop.orders.fresh',
        testCaseResolutionStatusType: CreateStatusTypes.Assigned,
        testCaseResolutionStatusDetails: { assignee: aaron },
      },
    ]);
  });

  it('should reassign an incident assigned to someone else', () => {
    const { entries, unchanged } = buildBulkIncidentEntries([assignedToAaron], {
      kind: 'status',
      status: CreateStatusTypes.Assigned,
      details: { assignee: bea },
    });

    expect(unchanged).toBe(0);
    expect(entries[0].testCaseResolutionStatusDetails).toEqual({
      assignee: bea,
    });
  });

  it('should carry the resolution reason and comment', () => {
    const details = {
      testCaseFailureReason: TestCaseFailureReasonType.FalsePositive,
      testCaseFailureComment: 'Expected after the backfill',
    };

    expect(
      buildBulkIncidentEntries([acked], {
        kind: 'status',
        status: CreateStatusTypes.Resolved,
        details,
      }).entries
    ).toEqual([
      {
        testCaseReference: 'svc.db.shop.orders.acked',
        testCaseResolutionStatusType: CreateStatusTypes.Resolved,
        testCaseResolutionStatusDetails: details,
      },
    ]);
  });

  it('should change only the severity, keeping each status and its details', () => {
    expect(
      buildBulkIncidentEntries([fresh, acked, assignedToAaron], {
        kind: 'severity',
        severity: CreateSeverities.Severity1,
      })
    ).toEqual({
      entries: [
        {
          testCaseReference: 'svc.db.shop.orders.fresh',
          testCaseResolutionStatusType: CreateStatusTypes.New,
          testCaseResolutionStatusDetails: undefined,
          severity: CreateSeverities.Severity1,
        },
        {
          testCaseReference: 'svc.db.shop.orders.acked',
          testCaseResolutionStatusType: CreateStatusTypes.ACK,
          testCaseResolutionStatusDetails: undefined,
          severity: CreateSeverities.Severity1,
        },
      ],
      unchanged: 1,
    });
  });

  it('should key an incident with no test case reference by an empty FQN', () => {
    expect(
      buildBulkIncidentEntries([{ ...fresh, testCaseReference: undefined }], {
        kind: 'status',
        status: CreateStatusTypes.ACK,
      }).entries[0].testCaseReference
    ).toBe('');
  });
});

describe('buildBulkIncidentEntries edge cases', () => {
  it('should assign an incident when no assignee is given yet', () => {
    expect(
      buildBulkIncidentEntries([fresh, assignedToAaron], {
        kind: 'status',
        status: CreateStatusTypes.Assigned,
      }).unchanged
    ).toBe(0);
  });

  it('should assign an assigned incident that lost its assignee', () => {
    expect(
      buildBulkIncidentEntries(
        [{ ...assignedToAaron, testCaseResolutionStatusDetails: undefined }],
        {
          kind: 'status',
          status: CreateStatusTypes.Assigned,
          details: { assignee: aaron },
        }
      ).unchanged
    ).toBe(0);
  });

  it('should give an incident without a severity the new one', () => {
    expect(
      buildBulkIncidentEntries([fresh], {
        kind: 'severity',
        severity: CreateSeverities.Severity5,
      }).entries
    ).toHaveLength(1);
  });
});

describe('chunkBulkIncidentEntries', () => {
  it('should split the entries in calls of at most 100', () => {
    const entries = Array.from({ length: 250 }, (_, index) => ({
      testCaseReference: `case-${index}`,
      testCaseResolutionStatusType: CreateStatusTypes.ACK,
    }));

    expect(
      chunkBulkIncidentEntries(entries).map((chunk) => chunk.length)
    ).toEqual([100, 100, 50]);
  });
});

describe('mergeBulkResults', () => {
  it('should add up every call and keep each failure', () => {
    expect(
      mergeBulkResults([
        { numberOfRowsPassed: 100, failedRequest: [] },
        {
          numberOfRowsPassed: 48,
          failedRequest: [
            {
              request: { testCaseReference: 'a' },
              message: 'Permission denied',
            },
            {
              request: { testCaseReference: 'b' },
              message: 'Incident is already Ack',
            },
          ],
        },
        {},
      ])
    ).toEqual({
      passed: 148,
      failures: [
        { request: { testCaseReference: 'a' }, message: 'Permission denied' },
        {
          request: { testCaseReference: 'b' },
          message: 'Incident is already Ack',
        },
      ],
    });
  });
});

describe('toBulkStatusDetails', () => {
  it('should hand an assignment the picked assignee', () => {
    expect(
      toBulkStatusDetails(CreateStatusTypes.Assigned, {
        assignee: { value: aaron },
      })
    ).toEqual({ assignee: aaron });
  });

  it('should hand a resolution its reason, comment and resolver', () => {
    expect(
      toBulkStatusDetails(
        CreateStatusTypes.Resolved,
        {
          testCaseFailureReason: { id: TestCaseFailureReasonType.Duplicates },
          testCaseFailureComment: 'Loaded twice',
        },
        bea
      )
    ).toEqual({
      testCaseFailureReason: TestCaseFailureReasonType.Duplicates,
      testCaseFailureComment: 'Loaded twice',
      resolvedBy: bea,
    });
  });

  it('should leave out what the form did not collect', () => {
    expect(toBulkStatusDetails(CreateStatusTypes.Assigned, {})).toEqual({
      assignee: undefined,
    });
    expect(toBulkStatusDetails(CreateStatusTypes.Resolved, {})).toEqual({
      testCaseFailureReason: undefined,
      testCaseFailureComment: undefined,
      resolvedBy: undefined,
    });
  });
});

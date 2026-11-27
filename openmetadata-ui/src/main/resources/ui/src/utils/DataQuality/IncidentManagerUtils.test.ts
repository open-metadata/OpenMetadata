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
import { TestCaseFailureReasonType } from '../../generated/tests/resolved';
import { TestCaseResolutionStatusTypes } from '../../generated/tests/testCaseResolutionStatus';
import {
  getListTestCaseIncidentByStateId,
  postTestCaseIncidentStatus,
} from '../../rest/incidentManagerAPI';
import { createTask } from '../../rest/tasksAPI';
import { reopenResolvedIncident } from './IncidentManagerUtils';

jest.mock('../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentByStateId: jest
    .fn()
    .mockResolvedValue({ data: [{ id: 'latest-id', stateId: 'state-1' }] }),
  postTestCaseIncidentStatus: jest
    .fn()
    .mockResolvedValue({ stateId: 'state-1' }),
}));

jest.mock('../../rest/tasksAPI', () => ({
  createTask: jest.fn().mockResolvedValue({ id: 'new-task-id' }),
  TaskCategory: { Incident: 'Incident' },
  TaskEntityType: { TestCaseResolution: 'TestCaseResolution' },
}));

jest.mock('../EntityPureUtils', () => ({
  getEntityFeedLink: jest.fn().mockReturnValue('<#E::testCase::fqn>'),
}));

const BASE = {
  testCaseFqn: 'svc.db.schema.table.col.test',
  testCaseName: 'test',
  currentStateId: 'state-1',
};

describe('reopenResolvedIncident', () => {
  beforeEach(() => jest.clearAllMocks());

  it('New starts a fresh incident via createTask, not the reuse endpoint', async () => {
    await reopenResolvedIncident({
      ...BASE,
      targetStatus: TestCaseResolutionStatusTypes.New,
    });

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(postTestCaseIncidentStatus).not.toHaveBeenCalled();
  });

  it('Resolved updates the same incident via postTestCaseIncidentStatus', async () => {
    await reopenResolvedIncident({
      ...BASE,
      targetStatus: TestCaseResolutionStatusTypes.Resolved,
    });

    expect(postTestCaseIncidentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        testCaseReference: BASE.testCaseFqn,
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      })
    );
    expect(createTask).not.toHaveBeenCalled();
  });

  it.each([
    TestCaseResolutionStatusTypes.ACK,
    TestCaseResolutionStatusTypes.Assigned,
  ])(
    'propagates the backend rejection of %s on a resolved incident without creating a new task',
    async (targetStatus) => {
      jest
        .mocked(postTestCaseIncidentStatus)
        .mockRejectedValueOnce(new Error('Incident is resolved'));

      await expect(
        reopenResolvedIncident({ ...BASE, targetStatus })
      ).rejects.toThrow('Incident is resolved');
      expect(createTask).not.toHaveBeenCalled();
      expect(getListTestCaseIncidentByStateId).not.toHaveBeenCalled();
    }
  );

  it('carries reason and comment when updating a resolved incident', async () => {
    await reopenResolvedIncident({
      ...BASE,
      targetStatus: TestCaseResolutionStatusTypes.Resolved,
      details: {
        reason: TestCaseFailureReasonType.FalsePositive,
        comment: 'resolved by mistake',
      },
    });

    expect(postTestCaseIncidentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        testCaseResolutionStatusDetails: {
          testCaseFailureReason: TestCaseFailureReasonType.FalsePositive,
          testCaseFailureComment: 'resolved by mistake',
        },
      })
    );
  });

  it('returns the latest resolution-status record for the reopened stateId', async () => {
    const result = await reopenResolvedIncident({
      ...BASE,
      targetStatus: TestCaseResolutionStatusTypes.Resolved,
    });

    expect(getListTestCaseIncidentByStateId).toHaveBeenCalledWith('state-1', {
      limit: 1,
    });
    expect(result).toEqual({ id: 'latest-id', stateId: 'state-1' });
  });
});

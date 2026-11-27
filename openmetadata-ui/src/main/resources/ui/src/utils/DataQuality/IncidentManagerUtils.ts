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
import { CreateTestCaseResolutionStatus } from '../../generated/api/tests/createTestCaseResolutionStatus';
import { TestCaseFailureReasonType } from '../../generated/tests/resolved';
import {
  EntityReference,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../generated/tests/testCaseResolutionStatus';
import {
  getListTestCaseIncidentByStateId,
  postTestCaseIncidentStatus,
} from '../../rest/incidentManagerAPI';
import { createTask, TaskCategory, TaskEntityType } from '../../rest/tasksAPI';
import { getEntityFeedLink } from '../EntityPureUtils';

export interface ReopenIncidentParams {
  testCaseFqn: string;
  testCaseName: string;
  targetStatus: TestCaseResolutionStatusTypes;
  currentStateId?: string;
  details?: {
    assignee?: EntityReference;
    reason?: TestCaseFailureReasonType;
    comment?: string;
  };
}

const getLatestIncident = async (
  stateId?: string
): Promise<TestCaseResolutionStatus | undefined> => {
  if (!stateId) {
    return undefined;
  }

  const { data } = await getListTestCaseIncidentByStateId(stateId, {
    limit: 1,
  });

  return data?.[0];
};

const getReopenStatusDetails = (
  targetStatus: TestCaseResolutionStatusTypes,
  details?: ReopenIncidentParams['details']
): CreateTestCaseResolutionStatus['testCaseResolutionStatusDetails'] => {
  if (targetStatus === TestCaseResolutionStatusTypes.Resolved) {
    return {
      testCaseFailureReason: details?.reason,
      testCaseFailureComment: details?.comment,
    };
  }

  return undefined;
};

/**
 * Shared by incident-status surfaces: `New` starts a fresh incident (a new task), while
 * `Resolved` updates the existing incident's resolution details. The backend rejects Ack and
 * Assigned for a resolved incident. Returns the latest resolution-status record for onSubmit.
 */
export const reopenResolvedIncident = async ({
  testCaseFqn,
  testCaseName,
  targetStatus,
  currentStateId,
  details,
}: ReopenIncidentParams): Promise<TestCaseResolutionStatus | undefined> => {
  if (targetStatus === TestCaseResolutionStatusTypes.New) {
    const newTask = await createTask({
      name: `Incident: ${testCaseName}`,
      category: TaskCategory.Incident,
      type: TaskEntityType.TestCaseResolution,
      about: getEntityFeedLink('testCase', testCaseFqn),
    });

    return getLatestIncident(newTask.id);
  }

  const reopened = await postTestCaseIncidentStatus({
    testCaseReference: testCaseFqn,
    testCaseResolutionStatusType: targetStatus,
    testCaseResolutionStatusDetails: getReopenStatusDetails(
      targetStatus,
      details
    ),
  });

  return getLatestIncident(reopened?.stateId ?? currentStateId);
};

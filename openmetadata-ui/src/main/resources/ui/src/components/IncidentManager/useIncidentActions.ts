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
import { AxiosError } from 'axios';
import { Dispatch, SetStateAction, useCallback } from 'react';
import { EntityReference } from '../../generated/tests/testCase';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../generated/tests/testCaseResolutionStatus';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import {
  getListTestCaseIncidentByStateId,
  transitionIncident,
} from '../../rest/incidentManagerAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { submitIncidentSeverity } from './IncidentManager.utils';

export interface UseIncidentActionsProps {
  setTestCaseListData: Dispatch<SetStateAction<TestCaseIncidentStatusData>>;
}

/**
 * Owns the row-mutation handlers that patch the in-memory incident list: a
 * severity patch, an assignee (re)assignment transition and an optimistic
 * status replace. Each mutates the list through the injected setter.
 */
export const useIncidentActions = ({
  setTestCaseListData,
}: UseIncidentActionsProps) => {
  const handleSeveritySubmit = async (
    record: TestCaseResolutionStatus,
    severity?: Severities
  ) => {
    if (!(await submitIncidentSeverity(record, severity))) {
      return;
    }
    setTestCaseListData((prev) => ({
      ...prev,
      data: prev.data.map((item) =>
        item.id === record.id ? { ...record, severity } : item
      ),
    }));
  };

  const handleAssigneeUpdate = useCallback(
    async (record: TestCaseResolutionStatus, assignee?: EntityReference[]) => {
      const taskId = record.stateId;
      if (!taskId) {
        return;
      }

      const assigneeData = assignee?.[0];
      const transitionId =
        record.testCaseResolutionStatusType ===
        TestCaseResolutionStatusTypes.Assigned
          ? 'reassign'
          : 'assign';

      try {
        await transitionIncident(taskId, {
          transitionId,
          payload: assigneeData
            ? {
                assignees: [
                  {
                    id: assigneeData.id,
                    type: assigneeData.type ?? 'user',
                    name: assigneeData.name,
                    fullyQualifiedName:
                      assigneeData.fullyQualifiedName ?? assigneeData.name,
                    displayName: assigneeData.displayName,
                  },
                ],
              }
            : undefined,
        });

        const refreshed = await getListTestCaseIncidentByStateId(taskId);
        const latest = refreshed?.data?.[0];
        if (!latest) {
          return;
        }

        setTestCaseListData((prev) => {
          const testCaseList = prev.data.map((item) => {
            if (item.stateId === latest.stateId) {
              return latest;
            }

            return item;
          });

          return {
            ...prev,
            data: testCaseList,
          };
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [setTestCaseListData]
  );

  const handleStatusSubmit = useCallback(
    (value: TestCaseResolutionStatus) => {
      setTestCaseListData((prev) => {
        const testCaseList = prev.data.map((item) => {
          if (
            item.testCaseReference?.fullyQualifiedName ===
            value.testCaseReference?.fullyQualifiedName
          ) {
            return value;
          }

          return item;
        });

        return {
          ...prev,
          data: testCaseList,
        };
      });
    },
    [setTestCaseListData]
  );

  return {
    handleSeveritySubmit,
    handleAssigneeUpdate,
    handleStatusSubmit,
  };
};

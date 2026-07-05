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
import { compare } from 'fast-json-patch';
import { first, isEmpty, isUndefined, last } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
  ChangeDescription,
  EntityReference,
  TestCase,
} from '../../../../generated/tests/testCase';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { useEntityRules } from '../../../../hooks/useEntityRules';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import {
  getIncidentTaskByStateId,
  getListTestCaseIncidentByStateId,
  Task,
  transitionIncident,
  updateTestCaseIncidentById,
} from '../../../../rest/incidentManagerAPI';
import { updateTestCaseById } from '../../../../rest/testAPI';
import { getColumnNameFromEntityLink } from '../../../../utils/EntityPureUtils';
import { getCommonExtraInfoForVersionDetails } from '../../../../utils/EntityVersionUtilsPure';
import { getEntityFQN } from '../../../../utils/FeedUtilsPure';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { getPrioritizedEditPermission } from '../../../../utils/PermissionsUtils';
import { getTaskDisplayId } from '../../../../utils/TaskNavigationUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';

export interface UseTestCaseIncidentHeaderProps {
  fetchTaskCount: () => void;
  isVersionPage?: boolean;
}

export interface TaskLinkInfo {
  path: string;
  label: string;
}

export interface UseTestCaseIncidentHeaderResult {
  testCaseData: TestCase | undefined;
  incidentTask: Task | null;
  testCaseStatusData: TestCaseResolutionStatus | undefined;
  isLoading: boolean;
  taskLinkInfo: TaskLinkInfo | null;
  ownerDisplayName:
    | ReturnType<typeof getCommonExtraInfoForVersionDetails>['ownerDisplayName']
    | undefined;
  ownerRef:
    | ReturnType<typeof getCommonExtraInfoForVersionDetails>['ownerRef']
    | undefined;
  columnName: string | null;
  tableFqn: string;
  dimensionKey: string | undefined;
  hasEditStatusPermission: boolean | undefined;
  hasEditOwnerPermission: boolean | undefined;
  hasEditDomainPermission: boolean;
  canAddMultipleUserOwners: boolean;
  canAddMultipleTeamOwner: boolean;
  handleSeverityUpdate: (severity?: Severities) => Promise<void>;
  handleAssigneeUpdate: (assignee?: EntityReference[]) => Promise<void>;
  handleDomainUpdate: (
    selectedDomain: EntityReference | EntityReference[]
  ) => Promise<void>;
  onIncidentStatusUpdate: (data: TestCaseResolutionStatus) => void;
}

/**
 * Incident-context data + handlers for the test-case details strip
 * (owner / incident / status / assignee / severity / table / test type).
 * Shared by the OSS antd renderer (IncidentManagerPageHeader) and the
 * AskCollate AI strip — each renderer only lays the fields out.
 */
export const useTestCaseIncidentHeader = ({
  fetchTaskCount,
  isVersionPage = false,
}: UseTestCaseIncidentHeaderProps): UseTestCaseIncidentHeaderResult => {
  const { entityRules } = useEntityRules(EntityType.TABLE);
  const [incidentTask, setIncidentTask] = useState<Task | null>(null);
  const [testCaseStatusData, setTestCaseStatusData] =
    useState<TestCaseResolutionStatus>();
  const [isLoading, setIsLoading] = useState(true);
  const {
    testCase: testCaseData,
    testCasePermission,
    setTestCase,
  } = useTestCaseStore();

  const { dimensionKey } = useRequiredParams<{
    fqn: string;
    dimensionKey?: string;
  }>();
  const { testCaseResolutionStatus, updateTestCaseIncidentStatus } =
    useActivityFeedProvider();

  const { ownerDisplayName, ownerRef } = useMemo(() => {
    // Owner diff styling belongs to the version page only; the live page
    // renders owners plainly even when the entity carries a
    // changeDescription (e.g. right after an owner update).
    if (!isVersionPage) {
      return { ownerDisplayName: undefined, ownerRef: undefined };
    }

    return getCommonExtraInfoForVersionDetails(
      testCaseData?.changeDescription as ChangeDescription,
      testCaseData?.owners
    );
  }, [isVersionPage, testCaseData?.changeDescription, testCaseData?.owners]);

  const columnName = useMemo(() => {
    const isColumn = testCaseData?.entityLink.includes('::columns::');
    if (isColumn) {
      const name = getColumnNameFromEntityLink(testCaseData?.entityLink ?? '');

      return name;
    }

    return null;
  }, [testCaseData]);

  const tableFqn = useMemo(
    () => getEntityFQN(testCaseData?.entityLink ?? ''),
    [testCaseData]
  );

  const handleSeverityUpdate = async (severity?: Severities) => {
    if (isUndefined(testCaseStatusData)) {
      return;
    }

    const updatedData = { ...testCaseStatusData, severity };
    const patch = compare(testCaseStatusData, updatedData);
    try {
      await updateTestCaseIncidentById(testCaseStatusData.id ?? '', patch);
      setTestCaseStatusData(updatedData);
      updateTestCaseIncidentStatus([
        ...testCaseResolutionStatus.slice(0, -1),
        updatedData,
      ]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onIncidentStatusUpdate = (data: TestCaseResolutionStatus) => {
    setTestCaseStatusData(data);
    updateTestCaseIncidentStatus([...testCaseResolutionStatus, data]);
  };

  const handleAssigneeUpdate = async (assignee?: EntityReference[]) => {
    if (isUndefined(testCaseStatusData)) {
      return;
    }

    const taskId = testCaseStatusData.stateId;
    if (!taskId) {
      return;
    }

    const assigneeData = assignee?.[0];
    const transitionId =
      testCaseStatusData.testCaseResolutionStatusType ===
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
      if (latest) {
        onIncidentStatusUpdate(latest);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchTestCaseResolution = async (id: string) => {
    try {
      const { data } = await getListTestCaseIncidentByStateId(id);

      setTestCaseStatusData(first(data));
    } catch {
      setTestCaseStatusData(undefined);
    }
  };

  const fetchIncidentTask = async (stateId: string) => {
    try {
      const task = await getIncidentTaskByStateId(stateId);
      setIncidentTask(task);
    } catch {
      setIncidentTask(null);
    }
  };

  // In task-first mode, stateId equals the task UUID (see
  // IncidentTcrsSyncHandler). The pre-task-first code read from
  // payload.testCaseResolutionStatusId, but that field doesn't exist
  // in the new task system.
  const incidentStateId = useMemo(() => incidentTask?.id, [incidentTask]);

  useEffect(() => {
    const status = last(testCaseResolutionStatus);

    if (status?.stateId === incidentStateId) {
      setTestCaseStatusData(status);
      if (
        status?.testCaseResolutionStatusType ===
        TestCaseResolutionStatusTypes.Resolved
      ) {
        fetchTaskCount();
      }
    }
  }, [testCaseResolutionStatus, incidentStateId, fetchTaskCount]);

  useEffect(() => {
    if (testCaseData?.incidentId) {
      setIsLoading(true);
      Promise.allSettled([
        fetchTestCaseResolution(testCaseData.incidentId),
        fetchIncidentTask(testCaseData.incidentId),
      ]).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [testCaseData]);

  const handleDomainUpdate = async (
    selectedDomain: EntityReference | EntityReference[]
  ) => {
    if (!testCaseData) {
      return;
    }

    let domains: EntityReference[] = [];
    if (Array.isArray(selectedDomain)) {
      domains = selectedDomain;
    } else if (!isEmpty(selectedDomain)) {
      domains = [selectedDomain];
    }

    const patch = compare(testCaseData, { ...testCaseData, domains });
    if (patch.length && testCaseData.id) {
      try {
        const updated = await updateTestCaseById(testCaseData.id, patch);
        setTestCase(updated);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const { hasEditStatusPermission, hasEditOwnerPermission } = useMemo(() => {
    return isVersionPage
      ? {
          hasEditStatusPermission: false,
          hasEditOwnerPermission: false,
        }
      : {
          hasEditStatusPermission:
            testCasePermission &&
            getPrioritizedEditPermission(
              testCasePermission,
              Operation.EditStatus
            ),
          hasEditOwnerPermission:
            testCasePermission &&
            getPrioritizedEditPermission(
              testCasePermission,
              Operation.EditOwners
            ),
        };
  }, [testCasePermission, isVersionPage, getPrioritizedEditPermission]);

  const taskLinkInfo = useMemo(
    () =>
      incidentTask
        ? {
            path: observabilityRouterClassBase.getIncidentTaskPath(
              incidentTask,
              testCaseData?.fullyQualifiedName
            ),
            label: `#${getTaskDisplayId(incidentTask.taskId)}`,
          }
        : null,
    [incidentTask, testCaseData?.fullyQualifiedName]
  );

  return {
    testCaseData,
    incidentTask,
    testCaseStatusData,
    isLoading,
    taskLinkInfo,
    ownerDisplayName,
    ownerRef,
    columnName,
    tableFqn,
    dimensionKey,
    hasEditStatusPermission,
    hasEditOwnerPermission,
    hasEditDomainPermission:
      !isVersionPage && Boolean(testCasePermission?.EditAll),
    canAddMultipleUserOwners: entityRules.canAddMultipleUserOwners,
    canAddMultipleTeamOwner: entityRules.canAddMultipleTeamOwner,
    handleSeverityUpdate,
    handleAssigneeUpdate,
    handleDomainUpdate,
    onIncidentStatusUpdate,
  };
};

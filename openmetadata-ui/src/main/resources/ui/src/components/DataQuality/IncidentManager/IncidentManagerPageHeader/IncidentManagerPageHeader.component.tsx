/*
 *  Copyright 2024 Collate.
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
import { Typography } from '@openmetadata/ui-core-components';
import { Divider, Skeleton, Space, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { first, isUndefined, last } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as InternalLinkIcon } from '../../../../assets/svg/InternalIcons.svg';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
  ChangeDescription,
  EntityReference,
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
import { getNameFromFQN } from '../../../../utils/CommonUtils';
import {
  getColumnNameFromEntityLink,
  getEntityName,
} from '../../../../utils/EntityUtils';
import { getCommonExtraInfoForVersionDetails } from '../../../../utils/EntityVersionUtils';
import { getEntityFQN } from '../../../../utils/FeedUtils';
import { getPrioritizedEditPermission } from '../../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { getTaskDisplayId } from '../../../../utils/TasksUtils';
import { getTaskDetailPath as getNewTaskDetailPath } from '../../../../utils/TaskUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import { ProfilerTabPath } from '../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import Severity from '../Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../TestCaseStatus/TestCaseIncidentManagerStatus.component';
import './incident-manager.less';
import { IncidentManagerPageHeaderProps } from './IncidentManagerPageHeader.interface';

const IncidentManagerPageHeader = ({
  onOwnerUpdate,
  fetchTaskCount,
  isVersionPage = false,
}: IncidentManagerPageHeaderProps) => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.TABLE);
  const [incidentTask, setIncidentTask] = useState<Task | null>(null);
  const [testCaseStatusData, setTestCaseStatusData] =
    useState<TestCaseResolutionStatus>();
  const [isLoading, setIsLoading] = useState(true);
  const { testCase: testCaseData, testCasePermission } = useTestCaseStore();

  const { dimensionKey } = useRequiredParams<{
    fqn: string;
    dimensionKey?: string;
  }>();
  const { testCaseResolutionStatus, updateTestCaseIncidentStatus } =
    useActivityFeedProvider();

  const { ownerDisplayName, ownerRef } = useMemo(() => {
    return getCommonExtraInfoForVersionDetails(
      testCaseData?.changeDescription as ChangeDescription,
      testCaseData?.owners
    );
  }, [testCaseData?.changeDescription, testCaseData?.owners]);

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

  const statusDetails = useMemo(() => {
    if (isLoading) {
      return <Skeleton.Input size="small" />;
    }

    if (isUndefined(testCaseStatusData)) {
      return (
        <>
          <Divider className="self-center m-x-sm" type="vertical" />
          <Typography
            as="span"
            className="d-flex flex-col gap-3 text-xs whitespace-nowrap">
            <Typography as="span" className="text-blue font-medium text-sm">
              {t('label.incident-status')}
            </Typography>

            <Typography as="span">
              {t('label.no-entity', { entity: t('label.incident') })}
            </Typography>
          </Typography>
        </>
      );
    }

    const details = testCaseStatusData?.testCaseResolutionStatusDetails;

    const taskLinkInfo = incidentTask
      ? {
          path: getNewTaskDetailPath(incidentTask),
          label: `#${getTaskDisplayId(incidentTask.taskId)}`,
        }
      : null;

    return (
      <>
        {taskLinkInfo && (
          <>
            <Divider className="self-center m-x-sm" type="vertical" />
            <Typography
              as="span"
              className="d-flex flex-col gap-3 text-xs whitespace-nowrap">
              <Typography as="span" className="text-blue text-sm font-medium">
                {t('label.incident')}
              </Typography>

              <Link
                className="font-medium flex items-center gap-2"
                data-testid="incident-task-link"
                to={taskLinkInfo.path}>
                {taskLinkInfo.label}
                <InternalLinkIcon className="text-grey-muted" width="14px" />
              </Link>
            </Typography>
          </>
        )}
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography
          as="span"
          className="d-flex flex-col gap-2 text-xs whitespace-nowrap">
          <TestCaseIncidentManagerStatus
            newLook
            data={testCaseStatusData}
            hasPermission={hasEditStatusPermission}
            headerName={t('label.incident-status')}
            onSubmit={onIncidentStatusUpdate}
          />
        </Typography>
        <Divider className="self-center m-x-sm" type="vertical" />
        <div className="tw:w-full" data-testid="assignee">
          <OwnerLabel
            hasPermission={hasEditStatusPermission}
            isCompactView={false}
            multiple={{
              user: false,
              team: false,
            }}
            owners={details?.assignee ? [details.assignee] : []}
            placeHolder={t('label.assignee')}
            tooltipText={t('label.edit-entity', {
              entity: t('label.assignee'),
            })}
            onUpdate={handleAssigneeUpdate}
          />
        </div>
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography
          as="span"
          className="d-flex flex-col gap-2 whitespace-nowrap">
          <Severity
            newLook
            hasPermission={hasEditStatusPermission}
            headerName={t('label.severity')}
            severity={testCaseStatusData.severity}
            onSubmit={handleSeverityUpdate}
          />
        </Typography>
      </>
    );
  }, [testCaseStatusData, isLoading, incidentTask, hasEditStatusPermission]);

  return (
    <Space wrap align="center" className="incident-manager-header w-full ">
      <OwnerLabel
        hasPermission={hasEditOwnerPermission}
        isCompactView={false}
        multiple={{
          user: entityRules.canAddMultipleUserOwners,
          team: entityRules.canAddMultipleTeamOwner,
        }}
        ownerDisplayName={ownerDisplayName}
        owners={testCaseData?.owners ?? ownerRef}
        onUpdate={onOwnerUpdate}
      />
      {!isVersionPage && statusDetails}
      {tableFqn && (
        <>
          <Divider className="self-center m-x-sm" type="vertical" />
          <Typography
            as="span"
            className="flex flex-col gap-3 text-xs whitespace-nowrap">
            <Typography as="span" className="text-blue text-sm font-medium">
              {t('label.table')}
            </Typography>

            <Link
              className="font-medium flex-center gap-2"
              data-testid="table-name"
              to={getEntityDetailsPath(
                EntityType.TABLE,
                tableFqn,
                EntityTabs.PROFILER,
                ProfilerTabPath.DATA_QUALITY
              )}>
              {getNameFromFQN(tableFqn)}
              <InternalLinkIcon className="text-grey-muted" width="14px" />
            </Link>
          </Typography>
        </>
      )}
      {dimensionKey && (
        <>
          <Divider className="self-center m-x-sm" type="vertical" />
          <Typography
            as="span"
            className="flex flex-col gap-3 text-xs whitespace-nowrap">
            <Typography as="span" className="text-blue text-sm font-medium">
              {t('label.dimension')}
            </Typography>
            <Typography
              as="span"
              className="font-medium"
              data-testid="dimension-key">
              {dimensionKey}
            </Typography>
          </Typography>
        </>
      )}
      {columnName && (
        <>
          <Divider className="self-center m-x-sm" type="vertical" />
          <Typography
            as="span"
            className="flex flex-col gap-3 text-xs whitespace-nowrap">
            <Typography as="span" className="text-blue text-sm font-medium">
              {t('label.column')}
            </Typography>
            <Typography
              as="span"
              className="font-medium"
              data-testid="test-column-name">
              {columnName}
            </Typography>
          </Typography>
        </>
      )}
      <Divider className="self-center m-x-sm" type="vertical" />
      <Typography
        as="span"
        className="flex flex-col gap-3 text-xs whitespace-nowrap">
        <Typography as="span" className="text-blue text-sm font-medium">
          {t('label.test-type')}
        </Typography>
        <Tooltip
          placement="bottom"
          title={testCaseData?.testDefinition.description}>
          <Typography
            as="span"
            className="font-medium"
            data-testid="test-definition-name">
            {getEntityName(testCaseData?.testDefinition)}
          </Typography>
        </Tooltip>
      </Typography>
    </Space>
  );
};

export default IncidentManagerPageHeader;

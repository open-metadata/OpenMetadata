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
import { Divider, Skeleton, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { first, isUndefined, last } from 'lodash';
import QueryString from 'qs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as InternalLinkIcon } from '../../../../assets/svg/InternalIcons.svg';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { ThreadType } from '../../../../generated/api/feed/createThread';
import { CreateTestCaseResolutionStatus } from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import {
  Thread,
  ThreadTaskStatus,
} from '../../../../generated/entity/feed/thread';
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
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import {
  getListTestCaseIncidentByStateId,
  postTestCaseIncidentStatus,
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
import { getDecodedFqn } from '../../../../utils/StringsUtils';
import { getTaskDetailPath } from '../../../../utils/TasksUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import { TableProfilerTab } from '../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
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
  const [activeTask, setActiveTask] = useState<Thread>();
  const [testCaseStatusData, setTestCaseStatusData] =
    useState<TestCaseResolutionStatus>();
  const [isLoading, setIsLoading] = useState(true);
  const { testCase: testCaseData, testCasePermission } = useTestCaseStore();

  const { fqn } = useRequiredParams<{ fqn: string }>();
  const decodedFqn = getDecodedFqn(fqn);
  const {
    setActiveThread,
    entityThread,
    getFeedData,
    testCaseResolutionStatus,
    updateTestCaseIncidentStatus,
  } = useActivityFeedProvider();

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

  const handleSeverityUpdate = async (severity: Severities) => {
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

  const updateAssignee = async (data: CreateTestCaseResolutionStatus) => {
    try {
      await postTestCaseIncidentStatus(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onIncidentStatusUpdate = (data: TestCaseResolutionStatus) => {
    setTestCaseStatusData(data);
    updateTestCaseIncidentStatus([...testCaseResolutionStatus, data]);
  };

  const handleAssigneeUpdate = (assignee?: EntityReference[]) => {
    if (isUndefined(testCaseStatusData)) {
      return;
    }

    const assigneeData = assignee?.[0];

    const updatedData: TestCaseResolutionStatus = {
      ...testCaseStatusData,
      testCaseResolutionStatusDetails: {
        ...testCaseStatusData?.testCaseResolutionStatusDetails,
        assignee: assigneeData,
      },
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
    };

    const createTestCaseResolutionStatus: CreateTestCaseResolutionStatus = {
      severity: testCaseStatusData.severity,
      testCaseReference:
        testCaseStatusData.testCaseReference?.fullyQualifiedName ?? '',
      testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      testCaseResolutionStatusDetails: {
        assignee: assigneeData,
      },
    };

    updateAssignee(createTestCaseResolutionStatus);
    onIncidentStatusUpdate(updatedData);
  };

  const fetchTestCaseResolution = async (id: string) => {
    try {
      const { data } = await getListTestCaseIncidentByStateId(id);

      setTestCaseStatusData(first(data));
    } catch {
      setTestCaseStatusData(undefined);
    }
  };

  useEffect(() => {
    if (decodedFqn) {
      setIsLoading(true);
      getFeedData(
        undefined,
        undefined,
        ThreadType.Task,
        EntityType.TEST_CASE,
        decodedFqn
      ).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [decodedFqn]);

  useEffect(() => {
    const openTask = entityThread.find(
      (thread) => thread.task?.status === ThreadTaskStatus.Open
    );
    setActiveTask(openTask);
    setActiveThread(openTask);
  }, [entityThread]);

  useEffect(() => {
    const status = last(testCaseResolutionStatus);

    if (status?.stateId === activeTask?.task?.testCaseResolutionStatusId) {
      if (
        status?.testCaseResolutionStatusType ===
        TestCaseResolutionStatusTypes.Resolved
      ) {
        setTestCaseStatusData(undefined);
        fetchTaskCount();
      } else {
        setTestCaseStatusData(status);
      }
    }
  }, [testCaseResolutionStatus]);

  useEffect(() => {
    if (testCaseData?.incidentId) {
      fetchTestCaseResolution(testCaseData.incidentId);
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
          <Typography.Text className="d-flex flex-col gap-3 text-xs whitespace-nowrap">
            <span className="text-blue font-medium text-sm">
              {t('label.incident-status')}
            </span>

            <span>{t('label.no-entity', { entity: t('label.incident') })}</span>
          </Typography.Text>
        </>
      );
    }

    const details = testCaseStatusData?.testCaseResolutionStatusDetails;

    return (
      <>
        {activeTask && (
          <>
            <Divider className="self-center m-x-sm" type="vertical" />
            <Typography.Text className="d-flex flex-col gap-3 text-xs whitespace-nowrap">
              <span className="text-blue text-sm font-medium">
                {t('label.incident')}
              </span>

              <Link
                className="font-medium flex items-center gap-2"
                data-testid="table-name"
                to={getTaskDetailPath(activeTask)}>
                {`#${activeTask?.task?.id}`}
                <InternalLinkIcon className="text-grey-muted" width="14px" />
              </Link>
            </Typography.Text>
          </>
        )}
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography.Text className="d-flex flex-col gap-2 text-xs whitespace-nowrap">
          <TestCaseIncidentManagerStatus
            newLook
            data={testCaseStatusData}
            hasPermission={hasEditStatusPermission}
            headerName={t('label.incident-status')}
            onSubmit={onIncidentStatusUpdate}
          />
        </Typography.Text>
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography.Text
          className="d-flex flex-col gap-2 text-xs whitespace-nowrap"
          data-testid="assignee">
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
        </Typography.Text>
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography.Text className="d-flex flex-col  gap-2 whitespace-nowrap">
          <Severity
            newLook
            hasPermission={hasEditStatusPermission}
            headerName={t('label.severity')}
            severity={testCaseStatusData.severity}
            onSubmit={handleSeverityUpdate}
          />
        </Typography.Text>
      </>
    );
  }, [testCaseStatusData, isLoading, activeTask, hasEditStatusPermission]);

  return (
    <Space wrap align="center" className="incident-manager-header w-full ">
      <OwnerLabel
        hasPermission={hasEditOwnerPermission}
        isCompactView={false}
        ownerDisplayName={ownerDisplayName}
        owners={testCaseData?.owners ?? ownerRef}
        onUpdate={onOwnerUpdate}
      />
      {!isVersionPage && statusDetails}
      {tableFqn && (
        <>
          <Divider className="self-center m-x-sm" type="vertical" />
          <Typography.Text className="flex flex-col gap-3 text-xs whitespace-nowrap">
            <span className="text-blue text-sm font-medium">
              {t('label.table')}
            </span>

            <Link
              className="font-medium flex-center gap-2"
              data-testid="table-name"
              to={{
                pathname: getEntityDetailsPath(
                  EntityType.TABLE,
                  tableFqn,
                  EntityTabs.PROFILER
                ),
                search: QueryString.stringify({
                  activeTab: TableProfilerTab.DATA_QUALITY,
                }),
              }}>
              {getNameFromFQN(tableFqn)}
              <InternalLinkIcon className="text-grey-muted" width="14px" />
            </Link>
          </Typography.Text>
        </>
      )}
      {columnName && (
        <>
          <Divider className="self-center m-x-sm" type="vertical" />
          <Typography.Text className="flex flex-col gap-3 text-xs whitespace-nowrap">
            <span className="text-blue text-sm font-medium">
              {t('label.column')}
            </span>
            <span className="font-medium" data-testid="test-column-name">
              {columnName}
            </span>
          </Typography.Text>
        </>
      )}
      <Divider className="self-center m-x-sm" type="vertical" />
      <Typography.Text className="flex flex-col gap-3 text-xs whitespace-nowrap">
        <span className="text-blue text-sm font-medium">
          {t('label.test-type')}
        </span>
        <Tooltip
          placement="bottom"
          title={testCaseData?.testDefinition.description}>
          <span className="font-medium" data-testid="test-definition-name">
            {getEntityName(testCaseData?.testDefinition)}
          </span>
        </Tooltip>
      </Typography.Text>
    </Space>
  );
};

export default IncidentManagerPageHeader;

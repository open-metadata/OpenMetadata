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
import { Divider, Skeleton, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, last } from 'lodash';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { getTableTabPath } from '../../../constants/constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ThreadType } from '../../../generated/api/feed/createThread';
import {
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import { Operation } from '../../../generated/entity/policies/policy';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../generated/tests/testCaseResolutionStatus';
import { updateTestCaseIncidentById } from '../../../rest/incidentManagerAPI';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityFQN } from '../../../utils/FeedUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getDecodedFqn } from '../../../utils/StringsUtils';
import { getTaskDetailPath } from '../../../utils/TasksUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../PermissionProvider/PermissionProvider.interface';
import { TableProfilerTab } from '../../ProfilerDashboard/profilerDashboard.interface';
import Severity from '../Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../TestCaseStatus/TestCaseIncidentManagerStatus.component';
import { IncidentManagerPageHeaderProps } from './IncidentManagerPageHeader.interface';

const IncidentManagerPageHeader = ({
  onOwnerUpdate,
  testCaseData,
  fetchTaskCount,
}: IncidentManagerPageHeaderProps) => {
  const { t } = useTranslation();
  const [activeTask, setActiveTask] = useState<Thread>();
  const [testCaseStatusData, setTestCaseStatusData] =
    useState<TestCaseResolutionStatus>();
  const [isLoading, setIsLoading] = useState(true);

  const { fqn } = useParams<{ fqn: string }>();
  const decodedFqn = getDecodedFqn(fqn);
  const {
    setActiveThread,
    entityThread,
    getFeedData,
    testCaseResolutionStatus,
    updateTestCaseIncidentStatus,
  } = useActivityFeedProvider();

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

  const onIncidentStatusUpdate = (data: TestCaseResolutionStatus) => {
    setTestCaseStatusData(data);
    updateTestCaseIncidentStatus([...testCaseResolutionStatus, data]);
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

  const { permissions } = usePermissionProvider();
  const hasEditPermission = useMemo(() => {
    return checkPermission(
      Operation.EditAll,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const statusDetails = useMemo(() => {
    if (isLoading) {
      return <Skeleton.Input size="small" />;
    }

    if (isUndefined(testCaseStatusData)) {
      return (
        <>
          <Divider className="self-center m-x-sm" type="vertical" />
          <Typography.Text className="d-flex items-center gap-2 text-xs whitespace-nowrap">
            <span className="text-grey-muted">{`${t(
              'label.incident-status'
            )}: `}</span>

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
            <Typography.Text className="d-flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="text-grey-muted">{`${t(
                'label.incident'
              )}: `}</span>

              <Link
                className="font-medium"
                data-testid="table-name"
                to={getTaskDetailPath(activeTask)}>
                {`#${activeTask?.task?.id}` ?? '--'}
              </Link>
            </Typography.Text>
          </>
        )}
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography.Text className="d-flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-grey-muted">{`${t(
            'label.incident-status'
          )}: `}</span>

          <TestCaseIncidentManagerStatus
            data={testCaseStatusData}
            onSubmit={onIncidentStatusUpdate}
          />
        </Typography.Text>
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography.Text className="d-flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-grey-muted">{`${t('label.assignee')}: `}</span>

          <OwnerLabel
            owner={details?.assignee}
            placeHolder={t('label.no-entity', {
              entity: t('label.assignee'),
            })}
          />
        </Typography.Text>
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography.Text className="d-flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-grey-muted">{`${t('label.severity')}: `}</span>

          <Severity
            severity={testCaseStatusData.severity}
            onSubmit={handleSeverityUpdate}
          />
        </Typography.Text>
      </>
    );
  }, [testCaseStatusData, isLoading, activeTask]);

  return (
    <Space align="center">
      <OwnerLabel
        hasPermission={hasEditPermission}
        owner={testCaseData?.owner}
        onUpdate={onOwnerUpdate}
      />
      {statusDetails}
      {tableFqn && (
        <>
          <Divider className="self-center m-x-sm" type="vertical" />
          <Typography.Text className="self-center text-xs whitespace-nowrap">
            <span className="text-grey-muted">{`${t('label.table')}: `}</span>

            <Link
              className="font-medium"
              data-testid="table-name"
              to={{
                pathname: getTableTabPath(tableFqn, EntityTabs.PROFILER),
                search: QueryString.stringify({
                  activeTab: TableProfilerTab.DATA_QUALITY,
                }),
              }}>
              {getNameFromFQN(tableFqn)}
            </Link>
          </Typography.Text>
        </>
      )}
      <Divider className="self-center m-x-sm" type="vertical" />
      <Typography.Text className="self-center text-xs whitespace-nowrap">
        <span className="text-grey-muted">{`${t('label.test-type')}: `}</span>
        <span className="font-medium" data-testid="test-definition-name">
          {getEntityName(testCaseData?.testDefinition)}
        </span>
      </Typography.Text>
    </Space>
  );
};

export default IncidentManagerPageHeader;

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
import { isUndefined } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTableTabPath } from '../../../constants/constants';
import { EntityTabs } from '../../../enums/entity.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/entity/type';
import { useIncidentManagerProvider } from '../../../pages/IncidentManager/IncidentManagerProvider/IncidentManagerProvider';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityFQN } from '../../../utils/FeedUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../PermissionProvider/PermissionProvider.interface';
import Severity from '../Severity/Severity.component';
import TestCaseIncidentManagerStatus from '../TestCaseStatus/TestCaseIncidentManagerStatus.component';

const IncidentManagerPageHeader = ({
  onOwnerUpdate,
}: {
  onOwnerUpdate: (owner?: EntityReference) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const {
    testCaseData,
    testCaseStatusData,
    onSeverityUpdate,
    onIncidentStatusUpdate,
  } = useIncidentManagerProvider();
  const tableFqn = useMemo(
    () => getEntityFQN(testCaseData?.entityLink ?? ''),
    [testCaseData]
  );

  const { permissions } = usePermissionProvider();
  const hasEditPermission = useMemo(() => {
    return checkPermission(
      Operation.EditAll,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const statusDetails = useMemo(() => {
    if (testCaseStatusData.isLoading) {
      return <Skeleton.Input size="small" />;
    }

    if (isUndefined(testCaseStatusData.status)) {
      return <></>;
    }

    const details = testCaseStatusData.status?.testCaseResolutionStatusDetails;

    return (
      <>
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography.Text className="d-flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-grey-muted">{`${t(
            'label.incident-status'
          )}: `}</span>

          <TestCaseIncidentManagerStatus
            data={testCaseStatusData.status}
            onSubmit={onIncidentStatusUpdate}
          />
        </Typography.Text>
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography.Text className="d-flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-grey-muted">{`${t(
            isUndefined(details?.resolvedBy)
              ? 'label.assignee'
              : 'label.resolved-by'
          )}: `}</span>

          <OwnerLabel
            owner={details?.resolvedBy ?? details?.assignee}
            placeHolder={t('label.no-entity', {
              entity: t('label.assignee'),
            })}
          />
        </Typography.Text>
        <Divider className="self-center m-x-sm" type="vertical" />
        <Typography.Text className="d-flex items-center gap-2 text-xs whitespace-nowrap">
          <span className="text-grey-muted">{`${t('label.severity')}: `}</span>

          <Severity
            severity={testCaseStatusData.status.severity}
            onSubmit={onSeverityUpdate}
          />
        </Typography.Text>
      </>
    );
  }, [testCaseStatusData]);

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
              to={getTableTabPath(tableFqn, EntityTabs.PROFILER)}>
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

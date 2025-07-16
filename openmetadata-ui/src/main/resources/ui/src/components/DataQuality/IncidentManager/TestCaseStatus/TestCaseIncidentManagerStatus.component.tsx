/*
 *  Copyright 2023 Collate.
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

import { Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import AppBadge from '../../../common/Badge/Badge.component';
import { EditIconButton } from '../../../common/IconButtons/EditIconButton';
import { TestCaseStatusModal } from '../../TestCaseStatusModal/TestCaseStatusModal.component';
import '../incident-manager.style.less';
import { TestCaseStatusIncidentManagerProps } from './TestCaseIncidentManagerStatus.interface';
const TestCaseIncidentManagerStatus = ({
  data,
  onSubmit,
  hasPermission,
  newLook = false,
  headerName,
}: TestCaseStatusIncidentManagerProps) => {
  const [isEditStatus, setIsEditStatus] = useState<boolean>(false);
  const { t } = useTranslation();

  const statusType = useMemo(() => data.testCaseResolutionStatusType, [data]);
  const { permissions } = usePermissionProvider();
  const hasEditPermission = useMemo(() => {
    return (
      hasPermission ??
      checkPermission(
        Operation.EditAll,
        ResourceEntity.TEST_CASE_RESOLUTION_STATUS,
        permissions
      )
    );
  }, [permissions, hasPermission]);

  const onEditStatus = useCallback(() => setIsEditStatus(true), []);
  const onCancel = useCallback(() => setIsEditStatus(false), []);

  if (!statusType) {
    return <Typography.Text>{NO_DATA_PLACEHOLDER}</Typography.Text>;
  }

  if (headerName) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <span className="font-medium text-blue text-sm">{headerName}</span>

          {hasEditPermission && (
            <EditIconButton
              data-testid="edit-resolution-icon"
              icon={<EditIcon width="14px" />}
              newLook={newLook}
              size="small"
              onClick={onEditStatus}
            />
          )}
        </div>
        <Tooltip
          placement="bottom"
          title={
            data?.updatedAt &&
            `${formatDate(data.updatedAt)}
                ${data.updatedBy ? 'by ' + getEntityName(data.updatedBy) : ''}`
          }>
          <Space
            align="center"
            data-testid={`${data.testCaseReference?.name}-status`}>
            <AppBadge
              className={classNames(
                'resolution',
                statusType.toLocaleLowerCase()
              )}
              label={statusType}
            />
          </Space>
        </Tooltip>

        {isEditStatus && (
          <TestCaseStatusModal
            data={data}
            open={isEditStatus}
            testCaseFqn={data.testCaseReference?.fullyQualifiedName ?? ''}
            onCancel={onCancel}
            onSubmit={onSubmit}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <Space
        align="center"
        data-testid={`${data.testCaseReference?.name}-status`}>
        <Tooltip
          placement="bottom"
          title={
            data?.updatedAt &&
            `${formatDate(data.updatedAt)}
                ${data.updatedBy ? 'by ' + getEntityName(data.updatedBy) : ''}`
          }>
          <AppBadge
            className={classNames('resolution', statusType.toLocaleLowerCase())}
            label={statusType}
          />
        </Tooltip>

        {hasEditPermission && (
          <EditIconButton
            newLook
            className="flex-center"
            data-testid="edit-resolution-icon"
            disabled={!hasEditPermission}
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.status'),
            })}
            onClick={onEditStatus}
          />
        )}
      </Space>

      {isEditStatus && (
        <TestCaseStatusModal
          data={data}
          open={isEditStatus}
          testCaseFqn={data.testCaseReference?.fullyQualifiedName ?? ''}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      )}
    </>
  );
};

export default TestCaseIncidentManagerStatus;

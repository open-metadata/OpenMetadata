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

import { Space, Tooltip } from 'antd';
import classNames from 'classnames';
import { startCase, toLower } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import AppBadge from '../../../common/Badge/Badge.component';
import { EditIconButton } from '../../../common/IconButtons/EditIconButton';
import '../incident-manager.style.less';
import { SeverityProps } from './Severity.interface';
import SeverityModal from './SeverityModal.component';

const Severity = ({
  severity,
  onSubmit,
  hasPermission,
  newLook = false,
  headerName,
}: SeverityProps) => {
  const { t } = useTranslation();
  const [isEditSeverity, setIsEditSeverity] = useState<boolean>(false);
  const { permissions } = usePermissionProvider();
  const hasEditPermission = useMemo(() => {
    return (
      hasPermission ??
      checkPermission(Operation.EditAll, ResourceEntity.TEST_CASE, permissions)
    );
  }, [permissions, hasPermission]);

  const onEditSeverity = useCallback(() => setIsEditSeverity(true), []);
  const onCancel = useCallback(() => setIsEditSeverity(false), []);

  const handleSubmit = useCallback(
    async (data: Severities) => {
      await onSubmit?.(data);
      onCancel();
    },
    [onSubmit]
  );
  if (headerName) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <span className="font-medium text-blue text-sm">{headerName}</span>
          {onSubmit && hasEditPermission && (
            <Tooltip
              title={t('label.edit-entity', {
                entity: t('label.severity'),
              })}>
              <EditIconButton
                data-testid="edit-severity-icon"
                icon={<EditIcon width="14px" />}
                newLook={newLook}
                size="small"
                onClick={onEditSeverity}
              />
            </Tooltip>
          )}
        </div>
        <Space align="center">
          {severity ? (
            <AppBadge
              className={classNames('severity', toLower(severity))}
              label={startCase(severity)}
            />
          ) : (
            NO_DATA_PLACEHOLDER
          )}
        </Space>

        {isEditSeverity && (
          <SeverityModal
            initialSeverity={severity}
            onCancel={onCancel}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <Space align="center">
        {severity ? (
          <AppBadge
            className={classNames('severity', toLower(severity))}
            label={startCase(severity)}
          />
        ) : (
          NO_DATA_PLACEHOLDER
        )}
        {onSubmit && hasEditPermission && (
          <EditIconButton
            newLook
            className="flex-center"
            data-testid="edit-severity-icon"
            disabled={!hasEditPermission}
            size="small"
            title={
              hasEditPermission
                ? t('label.edit-entity', {
                    entity: t('label.severity'),
                  })
                : NO_PERMISSION_FOR_ACTION
            }
            onClick={onEditSeverity}
          />
        )}
      </Space>

      {isEditSeverity && (
        <SeverityModal
          initialSeverity={severity}
          onCancel={onCancel}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
};

export default Severity;

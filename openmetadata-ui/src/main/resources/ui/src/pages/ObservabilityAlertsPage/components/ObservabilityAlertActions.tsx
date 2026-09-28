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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { Skeleton, Tooltip } from 'antd';
import { isUndefined } from 'lodash';
import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { ProviderType } from '../../../generated/events/eventSubscription';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import { ObservabilityAlertActionsProps } from '../ObservabilityAlertsPage.interface';

function ObservabilityAlertActions({
  alertPermission,
  loading,
  record,
  onEditAlert,
  onSelectAlert,
}: Readonly<ObservabilityAlertActionsProps>) {
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton active className="p-r-lg" paragraph={false} />;
  }

  if (
    isUndefined(alertPermission) ||
    (!alertPermission.edit && !alertPermission.delete)
  ) {
    return (
      <Typography className="p-l-xs" variant="text">
        {NO_DATA_PLACEHOLDER}
      </Typography>
    );
  }

  const editButton = (
    <Button
      aria-label={t('label.edit')}
      color="tertiary"
      data-testid={`alert-edit-${record.name}`}
      href={
        onEditAlert
          ? undefined
          : observabilityRouterClassBase.getObservabilityAlertsEditPath(
              record.fullyQualifiedName ?? ''
            )
      }
      iconLeading={EditIcon}
      size="md"
      onClick={
        onEditAlert
          ? (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              onEditAlert(record);
            }
          : undefined
      }
    />
  );

  return (
    <div className="d-flex items-center">
      {alertPermission.edit && (
        <Tooltip placement="bottom" title={t('label.edit')}>
          {editButton}
        </Tooltip>
      )}
      {alertPermission.delete && (
        <Tooltip placement="bottom" title={t('label.delete')}>
          <span className="tw:inline-flex">
            <Button
              aria-label={t('label.delete')}
              color="tertiary"
              data-testid={`alert-delete-${record.name}`}
              iconLeading={DeleteIcon}
              isDisabled={record.provider === ProviderType.System}
              size="md"
              onClick={() => onSelectAlert(record)}
            />
          </span>
        </Tooltip>
      )}
    </div>
  );
}

export default ObservabilityAlertActions;

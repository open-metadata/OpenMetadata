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

import { Button, Skeleton, Tooltip, Typography } from 'antd';
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
} from '../../../constants/constants';
import { ProviderType } from '../../../generated/events/eventSubscription';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import { ObservabilityAlertActionsProps } from '../ObservabilityAlertsPage.interface';

function ObservabilityAlertActions({
  alertPermission,
  loading,
  record,
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
      <Typography.Text className="p-l-xs">
        {NO_DATA_PLACEHOLDER}
      </Typography.Text>
    );
  }

  return (
    <div className="d-flex items-center">
      {alertPermission.edit && (
        <Tooltip placement="bottom" title={t('label.edit')}>
          <Link
            to={observabilityRouterClassBase.getObservabilityAlertsEditPath(
              record.fullyQualifiedName ?? ''
            )}>
            <Button
              className="flex flex-center"
              data-testid={`alert-edit-${record.name}`}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="16px" />}
              type="text"
            />
          </Link>
        </Tooltip>
      )}
      {alertPermission.delete && (
        <Tooltip placement="bottom" title={t('label.delete')}>
          <Button
            className="flex flex-center"
            data-testid={`alert-delete-${record.name}`}
            disabled={record.provider === ProviderType.System}
            icon={<DeleteIcon height={16} width={16} />}
            type="text"
            onClick={() => onSelectAlert(record)}
          />
        </Tooltip>
      )}
    </div>
  );
}

export default ObservabilityAlertActions;

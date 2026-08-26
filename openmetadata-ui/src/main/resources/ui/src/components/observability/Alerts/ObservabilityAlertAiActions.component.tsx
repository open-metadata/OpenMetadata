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

import {
  ButtonUtility,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit03, Trash01 } from '@untitledui/icons';
import { isUndefined } from 'lodash';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  EventSubscription,
  ProviderType,
} from '../../../generated/events/eventSubscription';
import { AlertPermission } from '../../../pages/ObservabilityAlertsPage/ObservabilityAlertsPage.interface';
import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

const ACTION_BUTTON_CLASS_NAME = 'tw:rounded-lg';
const ACTION_ICON_CLASS_NAME = 'tw:h-4 tw:w-4 tw:text-fg-quaternary';

interface ObservabilityAlertAiActionsProps {
  alertPermission?: AlertPermission;
  loading: boolean;
  record: EventSubscription;
  onEditAlert?: (alert: EventSubscription) => void;
  onSelectAlert: (alert: EventSubscription) => void;
}

function ObservabilityAlertAiActions({
  alertPermission,
  loading,
  record,
  onEditAlert,
  onSelectAlert,
}: Readonly<ObservabilityAlertAiActionsProps>) {
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton height={24} width={64} />;
  }

  if (
    isUndefined(alertPermission) ||
    (!alertPermission.edit && !alertPermission.delete)
  ) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {NO_DATA_PLACEHOLDER}
      </Typography>
    );
  }

  return (
    <div className="tw:flex tw:items-center tw:gap-1">
      {alertPermission.edit && onEditAlert && (
        <ButtonUtility
          className={ACTION_BUTTON_CLASS_NAME}
          data-testid={`alert-edit-${record.name}`}
          icon={<Edit03 className={ACTION_ICON_CLASS_NAME} />}
          tooltip={t('label.edit')}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onEditAlert(record);
          }}
        />
      )}
      {alertPermission.delete && (
        <ButtonUtility
          className={ACTION_BUTTON_CLASS_NAME}
          data-testid={`alert-delete-${record.name}`}
          icon={<Trash01 className={ACTION_ICON_CLASS_NAME} />}
          isDisabled={record.provider === ProviderType.System}
          tooltip={t('label.delete')}
          onClick={() => onSelectAlert(record)}
        />
      )}
    </div>
  );
}

export default ObservabilityAlertAiActions;

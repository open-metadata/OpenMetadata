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
  Box,
  ButtonUtility,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Trash01 } from '@openmetadata/ui-core-components/icons';
import { isUndefined } from 'lodash';
import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
    return (
      <div className="p-r-lg">
        <Skeleton height={16} />
      </div>
    );
  }

  if (
    isUndefined(alertPermission) ||
    (!alertPermission.edit && !alertPermission.delete)
  ) {
    return <Typography className="p-l-xs">{NO_DATA_PLACEHOLDER}</Typography>;
  }

  const editButton = (
    <ButtonUtility
      color="tertiary"
      data-testid={`alert-edit-${record.name}`}
      href={
        onEditAlert
          ? undefined
          : observabilityRouterClassBase.getObservabilityAlertsEditPath(
              record.fullyQualifiedName ?? ''
            )
      }
      icon={Edit01}
      size="lg"
      tooltip={t('label.edit')}
      tooltipPlacement="bottom"
      onClick={
        onEditAlert
          ? (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
              event.preventDefault();
              event.stopPropagation();
              onEditAlert(record);
            }
          : undefined
      }
    />
  );

  return (
    <Box align="center">
      {alertPermission.edit && editButton}
      {alertPermission.delete && (
        <ButtonUtility
          color="tertiary"
          data-testid={`alert-delete-${record.name}`}
          icon={Trash01}
          isDisabled={record.provider === ProviderType.System}
          size="lg"
          tooltip={t('label.delete')}
          tooltipPlacement="bottom"
          onClick={() => onSelectAlert(record)}
        />
      )}
    </Box>
  );
}

export default ObservabilityAlertActions;

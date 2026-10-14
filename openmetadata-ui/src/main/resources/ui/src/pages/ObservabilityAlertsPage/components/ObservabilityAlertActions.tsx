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
  Tooltip,
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

  return (
    <div className="d-flex items-center">
      {alertPermission.edit && (
        <Tooltip arrow placement="bottom" title={t('label.edit')}>
          {onEditAlert ? (
            <ButtonUtility
              data-testid={`alert-edit-${record.name}`}
              icon={Edit01}
              size="md"
              onClick={(event: MouseEvent) => {
                event.stopPropagation();
                onEditAlert(record);
              }}
            />
          ) : (
            <ButtonUtility
              data-testid={`alert-edit-${record.name}`}
              href={observabilityRouterClassBase.getObservabilityAlertsEditPath(
                record.fullyQualifiedName ?? ''
              )}
              icon={Edit01}
              size="md"
            />
          )}
        </Tooltip>
      )}
      {alertPermission.delete && (
        <Tooltip arrow placement="bottom" title={t('label.delete')}>
          <ButtonUtility
            data-testid={`alert-delete-${record.name}`}
            icon={Trash01}
            isDisabled={record.provider === ProviderType.System}
            size="md"
            onClick={() => onSelectAlert(record)}
          />
        </Tooltip>
      )}
    </div>
  );
}

export default ObservabilityAlertActions;

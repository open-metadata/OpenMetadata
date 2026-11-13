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
  Badge,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EventSubscription } from '../../../../generated/events/eventSubscription';
import { getAlertListStatus } from '../../../../utils/observability/alertStatus.utils';
import { ALERT_STATUS_BADGE } from './AlertStatusBadge.constants';

/** The alert's status in a list; a failed one shows why its destinations do not send on hover. */
function AlertStatusBadge({ alert }: Readonly<{ alert: EventSubscription }>) {
  const { t } = useTranslation();
  const { status, reasons, isConfigurationUnusable } = useMemo(
    () => getAlertListStatus(alert),
    [alert]
  );
  const { color, labelKey } = ALERT_STATUS_BADGE[status];
  const badge = (
    <Badge color={color} data-testid="alert-status" size="sm" type="pill-color">
      {t(labelKey)}
    </Badge>
  );

  if (reasons.length === 0) {
    return badge;
  }

  const title = isConfigurationUnusable
    ? t('message.destination-does-not-send-until-fixed')
    : t('label.failure-reason');

  return (
    <Tooltip description={reasons.join('\n')} title={title}>
      <TooltipTrigger
        aria-label={`${t(labelKey)}. ${title}: ${reasons.join(' ')}`}
        data-testid="alert-status-reason">
        {badge}
      </TooltipTrigger>
    </Tooltip>
  );
}

export default AlertStatusBadge;

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

import { Tooltip } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EventSubscription } from '../../../../generated/events/eventSubscription';
import { getAlertListStatus } from '../../../../utils/observability/alerts/alertStatus.utils';
import StatusBadgeV2 from '../../../common/StatusBadge/StatusBadgeV2.component';
import { ALERT_STATUS_BADGE } from './AlertStatusBadge.constants';
import { AlertStatusReasonSection } from './AlertStatusBadge.types';
import AlertStatusReasons from './AlertStatusReasons';

/** The alert's status in a list; one that is not sending says why on hover and focus. */
function AlertStatusBadge({ alert }: Readonly<{ alert: EventSubscription }>) {
  const { t } = useTranslation();
  const { status, unusableReasons, failureReasons } = useMemo(
    () => getAlertListStatus(alert),
    [alert]
  );
  const badge = ALERT_STATUS_BADGE[status];
  // Stored configurations to change, then sends that failed, each under its own heading.
  const sections: AlertStatusReasonSection[] = useMemo(
    () =>
      [
        {
          title: t('message.destination-does-not-send-until-fixed'),
          reasons: unusableReasons,
        },
        { title: t('label.failure-reason'), reasons: failureReasons },
      ].filter((section) => section.reasons.length > 0),
    [failureReasons, t, unusableReasons]
  );
  const statusBadge = (
    <StatusBadgeV2
      dataTestId="alert-status"
      label={t(badge.labelKey)}
      status={badge.status}
    />
  );

  // triggerClassName wraps the badge in a focusable trigger, so a keyboard reaches the reasons.
  return sections.length > 0 ? (
    <Tooltip
      description={<AlertStatusReasons sections={sections} />}
      title={sections[0].title}
      triggerClassName="tw:inline-flex">
      {statusBadge}
    </Tooltip>
  ) : (
    statusBadge
  );
}

export default AlertStatusBadge;

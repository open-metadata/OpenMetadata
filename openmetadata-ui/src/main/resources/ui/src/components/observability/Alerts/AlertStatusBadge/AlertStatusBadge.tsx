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

/** The alert's status in a list; one that is not sending says why on hover and focus. */
function AlertStatusBadge({ alert }: Readonly<{ alert: EventSubscription }>) {
  const { t } = useTranslation();
  const { status, unusableReasons, failureReasons } = useMemo(
    () => getAlertListStatus(alert),
    [alert]
  );
  const { color, labelKey } = ALERT_STATUS_BADGE[status];
  // Stored configurations to change, then sends that failed, each under its own heading.
  const sections = useMemo(
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
  const badge = (
    <Badge color={color} data-testid="alert-status" size="sm" type="pill-color">
      {t(labelKey)}
    </Badge>
  );

  if (sections.length === 0) {
    return badge;
  }

  const [first, ...rest] = sections;

  return (
    <Tooltip
      description={
        <>
          <span className="tw:block">{first.reasons.join('\n')}</span>
          {rest.map((section) => (
            <span className="tw:block tw:pt-2" key={section.title}>
              {`${section.title}: ${section.reasons.join('\n')}`}
            </span>
          ))}
        </>
      }
      title={first.title}>
      <TooltipTrigger
        aria-label={[
          t(labelKey),
          ...sections.map(
            (section) => `${section.title}: ${section.reasons.join(' ')}`
          ),
        ].join('. ')}
        data-testid="alert-status-reason">
        {badge}
      </TooltipTrigger>
    </Tooltip>
  );
}

export default AlertStatusBadge;

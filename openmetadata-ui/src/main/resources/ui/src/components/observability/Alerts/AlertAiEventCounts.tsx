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

import { Skeleton } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { EventsRecord } from '../../../generated/events/api/eventsRecord';
import { formatEventCount } from '../../../utils/Alerts/AlertsUtilPure';
import { ExtraInfoLabel } from '../../../utils/DataAssetsHeader.utils';

interface AlertAiEventCountsProps {
  counts?: EventsRecord;
  loading: boolean;
}

// Total and pending include unread events, which the server may count only up to a cap.
const COUNT_KEYS = [
  ['total-events-count', 'label.total-entity', 'totalEventsCount', true],
  ['pending-events-count', 'label.pending-entity', 'pendingEventsCount', true],
  ['failed-events-count', 'label.failed-entity', 'failedEventsCount', false],
] as const;

/** Total, pending and failed event counts shown in the alert details header. */
const AlertAiEventCounts = ({ counts, loading }: AlertAiEventCountsProps) => {
  const { t } = useTranslation();

  return (
    <>
      {COUNT_KEYS.map(([testId, labelKey, countKey, mayBeCapped]) =>
        loading ? (
          <Skeleton height={16} key={testId} variant="rounded" width={96} />
        ) : (
          <ExtraInfoLabel
            inlineLayout
            dataTestId={testId}
            key={testId}
            label={t(labelKey, { entity: t('label.event-plural') })}
            value={formatEventCount(
              counts?.[countKey],
              mayBeCapped && counts?.countsAreLowerBound
            )}
          />
        )
      )}
    </>
  );
};

export default AlertAiEventCounts;

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
import { useTranslation } from 'react-i18next';
import { EventsRecord } from '../../../generated/events/api/eventsRecord';
import { formatEventCount } from '../../../utils/Alerts/AlertsUtilPure';

interface AlertPendingEventsProps {
  counts?: EventsRecord;
}

/**
 * The pending event count of an alert. A disabled alert is not running, so it shows that instead
 * of a 0 that would read as an alert with nothing to do.
 */
const AlertPendingEvents = ({ counts }: AlertPendingEventsProps) => {
  const { t } = useTranslation();

  return counts?.enabled === false ? (
    <Tooltip title={t('message.disabled-alert-processes-no-events')}>
      <span data-testid="alert-not-running">{t('label.not-running')}</span>
    </Tooltip>
  ) : (
    <>
      {formatEventCount(
        counts?.pendingEventsCount,
        counts?.countsAreLowerBound
      )}
    </>
  );
};

export default AlertPendingEvents;

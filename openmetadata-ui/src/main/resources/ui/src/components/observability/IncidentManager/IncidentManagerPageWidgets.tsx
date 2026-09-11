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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PROFILER_FILTER_RANGE } from '../../../constants/profiler.constant';
import { TestCaseResolutionStatusTypes } from '../../../generated/tests/testCaseResolutionStatus';
import {
  getCurrentMillis,
  getEndOfDayInMillis,
  getEpochMillisForPastDays,
  getStartOfDayInMillis,
} from '../../../utils/date-time/DateTimeUtils';
import IncidentTimeChartWidget from '../../DataQuality/ChartWidgets/IncidentTimeChartWidget/IncidentTimeChartWidget.component';
import IncidentTypeAreaChartWidget from '../../DataQuality/ChartWidgets/IncidentTypeAreaChartWidget/IncidentTypeAreaChartWidget.component';
import { IncidentTimeMetricsType } from '../../DataQuality/DataQuality.interface';

const IncidentManagerPageWidgets = () => {
  const { t } = useTranslation();

  const DEFAULT_RANGE_DATA = useMemo(() => {
    return {
      startTs: getStartOfDayInMillis(
        getEpochMillisForPastDays(PROFILER_FILTER_RANGE.last60days.days)
      ),
      endTs: getEndOfDayInMillis(getCurrentMillis()),
    };
  }, []);

  return (
    <div className="incident-page-widgets tw:rounded-[10px] tw:border tw:border-border-secondary tw:bg-primary tw:p-6">
      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-2 tw:xl:grid-cols-4">
        <IncidentTypeAreaChartWidget
          chartFilter={DEFAULT_RANGE_DATA}
          height={60}
          incidentStatusType={TestCaseResolutionStatusTypes.New}
          name="open-incident"
          title={t('label.open-incident-plural')}
        />
        <IncidentTypeAreaChartWidget
          chartFilter={DEFAULT_RANGE_DATA}
          height={60}
          incidentStatusType={TestCaseResolutionStatusTypes.Resolved}
          name="resolved-incident"
          title={t('label.resolved-incident-plural')}
        />
        <IncidentTimeChartWidget
          chartFilter={DEFAULT_RANGE_DATA}
          height={60}
          incidentMetricType={IncidentTimeMetricsType.TIME_TO_RESPONSE}
          name="response-time"
          title={t('label.response-time')}
        />
        <IncidentTimeChartWidget
          chartFilter={DEFAULT_RANGE_DATA}
          height={60}
          incidentMetricType={IncidentTimeMetricsType.TIME_TO_RESOLUTION}
          name="resolution-time"
          title={t('label.resolution-time')}
        />
      </div>
    </div>
  );
};

export default IncidentManagerPageWidgets;

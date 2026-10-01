/*
 *  Copyright 2023 Collate.
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

import { Badge } from '@openmetadata/ui-core-components';
import {
  BarChart,
  type ChartSeries,
  type ChartTooltipProps,
  type ChartYAxisProps,
} from '@openmetadata/ui-core-components/charts';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_HISTOGRAM_DATA } from '../../../constants/profiler.constant';
import { HistogramClass } from '../../../generated/entity/data/table';
import { axisTickFormatter, tooltipFormatter } from '../../../utils/ChartUtils';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { DataDistributionHistogramProps } from './Chart.interface';

interface HistogramRow {
  name?: string;
  frequency: number;
}

const CHART_HEIGHT = 350;
const LEGEND_SHOWN = { show: true };
const Y_AXIS: ChartYAxisProps = {
  formatter: (value) => String(axisTickFormatter(Number(value))),
};
const TOOLTIP: ChartTooltipProps = {
  valueFormatter: (value) => String(tooltipFormatter(value)),
};

const DataDistributionHistogram = ({
  data,
  noDataPlaceholderText,
}: DataDistributionHistogramProps) => {
  const { t } = useTranslation();

  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'frequency',
        name: t('label.frequency'),
        status: 'info',
        seriesOption: { barWidth: 22 },
      },
    ],
    [t]
  );

  const charts = useMemo(
    () =>
      Object.entries(data)
        .filter(([, columnProfile]) => !isUndefined(columnProfile?.histogram))
        .map(([key, columnProfile]) => {
          const histogram =
            (columnProfile?.histogram as HistogramClass) ||
            DEFAULT_HISTOGRAM_DATA;
          const skew = columnProfile?.nonParametricSkew;
          let skewColor: 'success' | 'error' | 'blue' = 'blue';
          if (skew) {
            skewColor = skew > 0 ? 'success' : 'error';
          }

          return {
            key,
            skew,
            skewColor,
            date: customFormatDateTime(
              columnProfile?.timestamp || 0,
              'MMM dd, yyyy'
            ),
            rows: (histogram.frequencies ?? []).map(
              (frequency, i): HistogramRow => ({
                name: histogram.boundaries?.[i],
                frequency,
              })
            ),
          };
        }),
    [data]
  );

  const showSingleGraph =
    isUndefined(data.firstDayData?.histogram) ||
    isUndefined(data.currentDayData?.histogram);

  if (charts.length === 0) {
    return (
      <div className="tw:flex tw:items-center tw:justify-center tw:h-full tw:w-full">
        <ErrorPlaceHolder placeholderText={noDataPlaceholderText} />
      </div>
    );
  }

  return (
    <div className="tw:flex tw:w-full" data-testid="chart-container">
      {charts.map((chart, index) => (
        <div
          className={classNames(
            'tw:min-w-0 tw:flex tw:flex-col tw:pt-2 tw:pb-2',
            showSingleGraph
              ? 'tw:flex-1 tw:basis-full tw:px-4'
              : 'tw:flex-1 tw:basis-1/2 tw:px-3',
            {
              'tw:border-r tw:border-border-secondary':
                !showSingleGraph && index === 0,
            }
          )}
          key={chart.key}>
          <div className="tw:flex tw:items-center tw:justify-between tw:mb-5">
            <Badge
              className="tw:font-semibold"
              color="gray"
              data-testid="date"
              size="lg"
              type="color">
              {chart.date}
            </Badge>
            <Badge
              className="tw:font-semibold"
              color={chart.skewColor}
              size="lg"
              type="color">
              {`${t('label.skew')}: ${chart.skew || '--'}`}
            </Badge>
          </div>
          <div
            className="tw:flex-1 tw:min-h-87.5"
            id={`${chart.key}-histogram`}>
            <BarChart
              ariaLabel={`${t('label.frequency')} ${chart.date}`}
              data={chart.rows}
              height={CHART_HEIGHT}
              legend={LEGEND_SHOWN}
              radius={8}
              series={series}
              tooltip={TOOLTIP}
              xKey="name"
              yAxis={Y_AXIS}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DataDistributionHistogram;

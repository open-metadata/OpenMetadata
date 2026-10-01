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
  type ChartXAxisProps,
  type ChartYAxisProps,
  useChartPalette,
} from '@openmetadata/ui-core-components/charts';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnProfile } from '../../../generated/entity/data/table';
import { axisTickFormatter } from '../../../utils/ChartUtils';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';

export interface CardinalityDistributionChartProps {
  data: {
    firstDayData?: ColumnProfile;
    currentDayData?: ColumnProfile;
  };
  noDataPlaceholderText?: string | React.ReactNode;
}

interface CardinalityRow {
  name: string;
  count: number;
  percentage: number;
}

const MIN_HEIGHT = 350;
const ROW_HEIGHT = 30;
const LABEL_WIDTH = 120;
const PERCENT_AXIS: ChartYAxisProps = {
  formatter: (value) => String(axisTickFormatter(Number(value), '%')),
};
const TOOLTIP: ChartTooltipProps = { valueFormatter: (value) => `${value}%` };

// ECharts rich text is `{style|text}`; these characters would break it.
const richSafe = (value: string) => value.replace(/[{}|]/g, '');

const renderPlaceholder = (placeholderText?: string | React.ReactNode) => (
  <div className="tw:flex tw:items-center tw:justify-center tw:h-full tw:w-full tw:min-h-87.5">
    <ErrorPlaceHolder placeholderText={placeholderText} />
  </div>
);

interface CardinalityGraphProps {
  chartKey: string;
  rows: CardinalityRow[];
  ariaLabel: string;
  selectedCategory: string | null;
  onToggle: (category: string) => void;
}

const CardinalityGraph = ({
  chartKey,
  rows,
  ariaLabel,
  selectedCategory,
  onToggle,
}: CardinalityGraphProps) => {
  const { t } = useTranslation();
  const palette = useChartPalette();

  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'percentage',
        name: t('label.percentage'),
        status: 'info',
        seriesOption: { barWidth: 22, cursor: 'pointer' },
      },
    ],
    [t]
  );

  const categoryAxis = useMemo<ChartXAxisProps>(
    () => ({
      formatter: (value) => {
        const name = String(value);
        if (selectedCategory === null) {
          return name;
        }
        const style = name === selectedCategory ? 'selected' : 'dimmed';

        return `{${style}|${richSafe(name)}}`;
      },
      axisLabel: {
        width: LABEL_WIDTH,
        overflow: 'truncate',
        rich: {
          selected: { color: palette.status.info, fontWeight: 600 },
          dimmed: { opacity: 0.5 },
        },
      },
    }),
    [selectedCategory, palette]
  );

  const getBarStatus = useCallback(
    (row: CardinalityRow) =>
      selectedCategory !== null && row.name !== selectedCategory
        ? ('neutral' as const)
        : undefined,
    [selectedCategory]
  );

  const handlePointClick = useCallback(
    (row: CardinalityRow) => onToggle(row.name),
    [onToggle]
  );

  return (
    <div
      className="tw:flex-1 tw:min-h-87.5 tw:overflow-x-hidden"
      id={`${chartKey}-cardinality`}>
      <BarChart
        ariaLabel={ariaLabel}
        data={rows}
        getBarStatus={getBarStatus}
        height={Math.max(MIN_HEIGHT, rows.length * ROW_HEIGHT)}
        layout="horizontal"
        radius={8}
        series={series}
        tooltip={TOOLTIP}
        xAxis={categoryAxis}
        xKey="name"
        yAxis={PERCENT_AXIS}
        onCategoryClick={onToggle}
        onPointClick={handlePointClick}
      />
    </div>
  );
};

const CardinalityDistributionChart = ({
  data,
  noDataPlaceholderText,
}: CardinalityDistributionChartProps) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      Object.entries(data)
        .filter(
          ([, columnProfile]) =>
            !isUndefined(columnProfile?.cardinalityDistribution)
        )
        .map(([key, columnProfile]) => {
          const cardinality = columnProfile?.cardinalityDistribution;

          return {
            key,
            isAllUnique: cardinality?.allValuesUnique ?? false,
            categoriesCount: cardinality?.categories?.length || 0,
            date: customFormatDateTime(
              columnProfile?.timestamp || 0,
              'MMM dd, yyyy'
            ),
            rows: (cardinality?.categories ?? []).map(
              (category, i): CardinalityRow => ({
                name: category,
                count: cardinality?.counts?.[i] || 0,
                percentage: cardinality?.percentages?.[i] || 0,
              })
            ),
          };
        }),
    [data]
  );

  const handleToggle = useCallback(
    (name: string) =>
      setSelectedCategory((prev) => (prev === name ? null : name)),
    []
  );

  const firstDayAllUnique =
    data.firstDayData?.cardinalityDistribution?.allValuesUnique ?? false;
  const currentDayAllUnique =
    data.currentDayData?.cardinalityDistribution?.allValuesUnique ?? false;

  const showSingleGraph =
    isUndefined(data.firstDayData?.cardinalityDistribution) ||
    isUndefined(data.currentDayData?.cardinalityDistribution);

  if (entries.length === 0) {
    return renderPlaceholder(noDataPlaceholderText);
  }

  const allValuesUniqueMessage = t(
    'message.all-values-unique-no-distribution-available'
  );
  const chartAriaLabel = t('label.total-entity', {
    entity: t('label.category-plural'),
  });

  return (
    <div className="tw:flex tw:w-full" data-testid="chart-container">
      {firstDayAllUnique && currentDayAllUnique
        ? renderPlaceholder(allValuesUniqueMessage)
        : entries.map((entry, index) => (
            <div
              className={classNames(
                'tw:min-w-0 tw:flex tw:flex-col tw:pt-2 tw:pb-2',
                showSingleGraph
                  ? 'tw:flex-1 tw:basis-full tw:px-4'
                  : 'tw:flex-1 tw:basis-1/2 tw:px-6',
                {
                  'tw:border-r tw:border-border-secondary':
                    !showSingleGraph && index === 0,
                }
              )}
              key={entry.key}>
              {entry.isAllUnique ? (
                renderPlaceholder(allValuesUniqueMessage)
              ) : (
                <>
                  <div className="tw:flex tw:items-center tw:justify-between tw:mb-5">
                    <Badge
                      className="tw:font-semibold"
                      color="gray"
                      data-testid="date"
                      size="lg"
                      type="color">
                      {entry.date}
                    </Badge>
                    <Badge
                      className="tw:font-semibold"
                      color="gray"
                      data-testid="cardinality-tag"
                      size="lg"
                      type="color">
                      {`${chartAriaLabel}: ${entry.categoriesCount}`}
                    </Badge>
                  </div>
                  <CardinalityGraph
                    ariaLabel={chartAriaLabel}
                    chartKey={entry.key}
                    rows={entry.rows}
                    selectedCategory={selectedCategory}
                    onToggle={handleToggle}
                  />
                </>
              )}
            </div>
          ))}
    </div>
  );
};

export default CardinalityDistributionChart;

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
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHART_BLUE_1,
  COLOR_GREY_300,
  COLOR_GREY_400,
  GRAY_600,
  GREY_100,
  GREY_200,
} from '../../../constants/Color.constants';
import { GRAPH_BACKGROUND_COLOR } from '../../../constants/constants';
import { ColumnProfile } from '../../../generated/entity/data/table';
import {
  axisTickFormatter,
  createHorizontalGridLineRenderer,
  tooltipFormatter,
} from '../../../utils/ChartUtils';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';

export interface CardinalityDistributionChartProps {
  data: {
    firstDayData?: ColumnProfile;
    currentDayData?: ColumnProfile;
  };
  noDataPlaceholderText?: string | React.ReactNode;
}

const CardinalityDistributionChart = ({
  data,
  noDataPlaceholderText,
}: CardinalityDistributionChartProps) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const firstDayAllUnique =
    data.firstDayData?.cardinalityDistribution?.allValuesUnique ?? false;
  const currentDayAllUnique =
    data.currentDayData?.cardinalityDistribution?.allValuesUnique ?? false;

  const showSingleGraph =
    isUndefined(data.firstDayData?.cardinalityDistribution) ||
    isUndefined(data.currentDayData?.cardinalityDistribution);

  const renderHorizontalGridLine = useMemo(
    () => createHorizontalGridLineRenderer(),
    []
  );

  const renderPlaceholder = useMemo(
    () => (placeholderText: string | React.ReactNode) =>
      (
        <div className="tw:flex tw:items-center tw:justify-center tw:h-full tw:w-full tw:min-h-87.5">
          <ErrorPlaceHolder placeholderText={placeholderText} />
        </div>
      ),
    []
  );

  if (
    isUndefined(data.firstDayData?.cardinalityDistribution) &&
    isUndefined(data.currentDayData?.cardinalityDistribution)
  ) {
    return renderPlaceholder(noDataPlaceholderText);
  }

  const renderTooltip: TooltipProps<string | number, string>['content'] = (
    props
  ) => {
    const { active, payload } = props;
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div className="tw:bg-primary tw:rounded-md tw:shadow-md tw:p-2.5">
          <p className="tw:text-primary tw:font-medium tw:text-xs">
            {data.name}
          </p>
          <hr className="tw:border-primary tw:my-2 tw:border-dashed" />
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-6 tw:pb-1 tw:text-sm">
            <span className="tw:text-tertiary tw:text-[11px]">
              {t('label.count')}
            </span>
            <span className="tw:text-primary tw:font-medium tw:text-[11px]">
              {tooltipFormatter(data.count)}
            </span>
          </div>
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-6 tw:pb-1 tw:text-sm">
            <span className="tw:text-tertiary tw:text-[11px]">
              {t('label.percentage')}
            </span>
            <span className="tw:text-primary tw:font-medium tw:text-[11px]">
              {`${data.percentage}%`}
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  const dataEntries = Object.entries(data).filter(
    ([, columnProfile]) => !isUndefined(columnProfile?.cardinalityDistribution)
  );

  const bothAllUnique = firstDayAllUnique && currentDayAllUnique;
  const allValuesUniqueMessage = t(
    'message.all-values-unique-no-distribution-available'
  );

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory((prev) =>
      prev === categoryName ? null : categoryName
    );
  };

  const CustomYAxisTick = (props: {
    x?: number;
    y?: number;
    payload?: { value: string };
  }) => {
    const { x, y, payload } = props;
    if (!payload) {
      return null;
    }

    const categoryName = payload.value;
    const isSelected = selectedCategory === categoryName;
    const isHighlighted = selectedCategory && selectedCategory !== categoryName;

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          cursor="pointer"
          dy={4}
          fill={
            isSelected
              ? CHART_BLUE_1
              : isHighlighted
              ? COLOR_GREY_400
              : GRAY_600
          }
          fontSize={12}
          fontWeight={isSelected ? 600 : 400}
          opacity={isHighlighted ? 0.5 : 1}
          textAnchor="end"
          x={-8}
          onClick={() => handleCategoryClick(categoryName)}>
          {categoryName.length > 15
            ? `${categoryName.slice(0, 15)}...`
            : categoryName}
        </text>
      </g>
    );
  };

  return (
    <div className="tw:flex tw:w-full" data-testid="chart-container">
      {bothAllUnique
        ? renderPlaceholder(allValuesUniqueMessage)
        : dataEntries.map(([key, columnProfile], index) => {
            if (
              isUndefined(columnProfile) ||
              isUndefined(columnProfile?.cardinalityDistribution)
            ) {
              return;
            }

            const cardinalityData = columnProfile.cardinalityDistribution;
            const isAllUnique = cardinalityData.allValuesUnique ?? false;

            const graphData =
              cardinalityData.categories?.map((category, i) => ({
                name: category,
                count: cardinalityData.counts?.[i] || 0,
                percentage: cardinalityData.percentages?.[i] || 0,
              })) || [];

            const graphDate = customFormatDateTime(
              columnProfile?.timestamp || 0,
              'MMM dd, yyyy'
            );

            const containerHeight = Math.max(350, graphData.length * 30);

            const colClassName = classNames(
              'tw:min-w-0 tw:flex tw:flex-col tw:pt-2 tw:pb-2',
              showSingleGraph
                ? 'tw:flex-1 tw:basis-full tw:px-4'
                : 'tw:flex-1 tw:basis-1/2 tw:px-6',
              {
                'tw:border-r tw:border-border-secondary':
                  !showSingleGraph && index === 0,
              }
            );

            return (
              <div className={colClassName} key={key}>
                {isAllUnique ? (
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
                        {graphDate}
                      </Badge>
                      <Badge
                        className="tw:font-semibold"
                        color="gray"
                        data-testid="cardinality-tag"
                        size="lg"
                        type="color">
                        {`${t('label.total-entity', {
                          entity: t('label.category-plural'),
                        })}: ${cardinalityData.categories?.length || 0}`}
                      </Badge>
                    </div>
                    <div className="tw:flex-1 tw:min-h-87.5 tw:overflow-x-hidden">
                      <ResponsiveContainer
                        debounce={200}
                        height={containerHeight}
                        id={`${key}-cardinality`}
                        width="100%">
                        <BarChart
                          className="tw:w-full"
                          data={graphData}
                          layout="vertical">
                          <CartesianGrid
                            horizontal={renderHorizontalGridLine}
                            stroke={GRAPH_BACKGROUND_COLOR}
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            axisLine={false}
                            padding={{ left: 16, right: 16 }}
                            tick={{ fontSize: 12 }}
                            tickFormatter={(props) =>
                              axisTickFormatter(props, '%')
                            }
                            tickLine={false}
                            type="number"
                          />
                          <YAxis
                            allowDataOverflow
                            axisLine={false}
                            dataKey="name"
                            padding={{ top: 16, bottom: 16 }}
                            tick={<CustomYAxisTick />}
                            tickLine={false}
                            type="category"
                            width={120}
                          />
                          <Tooltip
                            content={renderTooltip}
                            cursor={{
                              fill: GREY_100,
                              stroke: GREY_200,
                              strokeDasharray: '3 3',
                            }}
                          />
                          <Bar
                            barSize={22}
                            dataKey="percentage"
                            radius={[0, 8, 8, 0]}>
                            {graphData.map((entry) => {
                              const isSelected =
                                selectedCategory === entry.name;
                              const isHighlighted =
                                selectedCategory &&
                                selectedCategory !== entry.name;

                              return (
                                <Cell
                                  cursor="pointer"
                                  fill={
                                    isSelected
                                      ? CHART_BLUE_1
                                      : isHighlighted
                                      ? COLOR_GREY_300
                                      : CHART_BLUE_1
                                  }
                                  key={`cell-${entry.name}`}
                                  opacity={isHighlighted ? 0.3 : 1}
                                  onClick={() =>
                                    handleCategoryClick(entry.name)
                                  }
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            );
          })}
    </div>
  );
};

export default CardinalityDistributionChart;

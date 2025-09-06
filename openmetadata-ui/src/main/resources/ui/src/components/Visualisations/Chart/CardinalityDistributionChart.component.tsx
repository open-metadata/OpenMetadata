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

import { Card, Col, Row, Tag } from 'antd';
import { isUndefined, map } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_BLUE_1 } from '../../../constants/Color.constants';
import { GRAPH_BACKGROUND_COLOR } from '../../../constants/constants';
import { ColumnProfile } from '../../../generated/entity/data/table';
import { axisTickFormatter, tooltipFormatter } from '../../../utils/ChartUtils';
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
  const showSingleGraph =
    isUndefined(data.firstDayData?.cardinalityDistribution) ||
    isUndefined(data.currentDayData?.cardinalityDistribution);

  if (
    isUndefined(data.firstDayData?.cardinalityDistribution) &&
    isUndefined(data.currentDayData?.cardinalityDistribution)
  ) {
    return (
      <Row align="middle" className="h-full w-full" justify="center">
        <Col>
          <ErrorPlaceHolder placeholderText={noDataPlaceholderText} />
        </Col>
      </Row>
    );
  }

  const renderTooltip: TooltipProps<string | number, string>['content'] = (
    props
  ) => {
    const { active, payload } = props;
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <Card>
          <p className="font-semibold text-sm mb-1">{`${t('label.category')}: ${
            data.name
          }`}</p>
          <p className="text-sm mb-1">{`${t('label.count')}: ${tooltipFormatter(
            data.count
          )}`}</p>
          <p className="text-sm">{`${t('label.percentage')}: ${
            data.percentage
          }%`}</p>
        </Card>
      );
    }

    return null;
  };

  return (
    <Row className="w-full" data-testid="chart-container">
      {map(data, (columnProfile, key) => {
        if (
          isUndefined(columnProfile) ||
          isUndefined(columnProfile?.cardinalityDistribution)
        ) {
          return;
        }

        const cardinalityData = columnProfile.cardinalityDistribution;

        const graphData =
          cardinalityData.categories?.map((category, i) => ({
            name: category,
            count: cardinalityData.counts?.[i] || 0,
            percentage: cardinalityData.percentages?.[i] || 0,
          })) || [];

        const graphDate = customFormatDateTime(
          columnProfile?.timestamp || 0,
          'MMM dd'
        );

        return (
          <Col key={key} span={showSingleGraph ? 24 : 12}>
            <Row gutter={[8, 8]}>
              <Col
                data-testid="date"
                offset={showSingleGraph ? 1 : 2}
                span={24}>
                {graphDate}
              </Col>
              <Col offset={showSingleGraph ? 1 : 2} span={24}>
                <Tag data-testid="cardinality-tag">{`${t('label.total-entity', {
                  entity: t('label.category-plural'),
                })}: ${cardinalityData.categories?.length || 0}`}</Tag>
              </Col>
              <Col span={24}>
                <ResponsiveContainer
                  debounce={200}
                  id={`${key}-cardinality`}
                  minHeight={300}>
                  <BarChart
                    className="w-full"
                    data={graphData}
                    layout="vertical"
                    margin={{ left: 16 }}>
                    <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} />
                    <XAxis
                      padding={{ left: 16, right: 16 }}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(props) => axisTickFormatter(props, '%')}
                      type="number"
                    />
                    <YAxis
                      allowDataOverflow
                      dataKey="name"
                      padding={{ top: 16, bottom: 16 }}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value: string) =>
                        value?.length > 15 ? `${value.slice(0, 15)}...` : value
                      }
                      type="category"
                      width={120}
                    />
                    <Legend />
                    <Tooltip content={renderTooltip} />
                    <Bar dataKey="percentage" fill={CHART_BLUE_1} />
                  </BarChart>
                </ResponsiveContainer>
              </Col>
            </Row>
          </Col>
        );
      })}
    </Row>
  );
};

export default CardinalityDistributionChart;

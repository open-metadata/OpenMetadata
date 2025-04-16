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

import { Col, Row, Tag } from 'antd';
import { isUndefined, map } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GRAPH_BACKGROUND_COLOR } from '../../../constants/constants';
import { DEFAULT_HISTOGRAM_DATA } from '../../../constants/profiler.constant';
import { HistogramClass } from '../../../generated/entity/data/table';
import { axisTickFormatter, tooltipFormatter } from '../../../utils/ChartUtils';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { DataDistributionHistogramProps } from './Chart.interface';

const DataDistributionHistogram = ({
  data,
  noDataPlaceholderText,
}: DataDistributionHistogramProps) => {
  const { t } = useTranslation();
  const showSingleGraph =
    isUndefined(data.firstDayData?.histogram) ||
    isUndefined(data.currentDayData?.histogram);

  if (
    isUndefined(data.firstDayData?.histogram) &&
    isUndefined(data.currentDayData?.histogram)
  ) {
    return (
      <Row align="middle" className="h-full w-full" justify="center">
        <Col>
          <ErrorPlaceHolder placeholderText={noDataPlaceholderText} />
        </Col>
      </Row>
    );
  }

  return (
    <Row className="w-full" data-testid="chart-container">
      {map(data, (columnProfile, key) => {
        if (isUndefined(columnProfile?.histogram)) {
          return;
        }

        const histogramData =
          (columnProfile?.histogram as HistogramClass) ||
          DEFAULT_HISTOGRAM_DATA;

        const graphData = histogramData.frequencies?.map((frequency, i) => ({
          name: histogramData?.boundaries?.[i],
          frequency,
        }));

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
                <Tag data-testid="skew-tag">{`${t('label.skew')}: ${
                  columnProfile?.nonParametricSkew || '--'
                }`}</Tag>
              </Col>
              <Col span={24}>
                <ResponsiveContainer
                  debounce={200}
                  id={`${key}-histogram`}
                  minHeight={300}>
                  <BarChart
                    className="w-full"
                    data={graphData}
                    margin={{ left: 16 }}>
                    <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} />
                    <XAxis
                      dataKey="name"
                      padding={{ left: 16, right: 16 }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      allowDataOverflow
                      padding={{ top: 16, bottom: 16 }}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(props) => axisTickFormatter(props)}
                    />
                    <Legend />
                    <Tooltip
                      formatter={(value: number | string) =>
                        tooltipFormatter(value)
                      }
                    />
                    <Bar dataKey="frequency" fill="#1890FF" />
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

export default DataDistributionHistogram;

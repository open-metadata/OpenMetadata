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
import { GRAPH_BACKGROUND_COLOR } from 'constants/constants';
import { DEFAULT_HISTOGRAM_DATA } from 'constants/profiler.constant';
import { HistogramClass } from 'generated/entity/data/table';
import React, { useMemo } from 'react';
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
import { axisTickFormatter, tooltipFormatter } from 'utils/ChartUtils';
import { getFormattedDateFromSeconds } from 'utils/TimeUtils';
import { DataDistributionHistogramProps } from './Chart.interface';

const DataDistributionHistogram = ({
  name,
  data,
}: DataDistributionHistogramProps) => {
  const { t } = useTranslation();
  const graphData = useMemo(() => {
    const histogramData =
      (data?.histogram as HistogramClass) || DEFAULT_HISTOGRAM_DATA;

    return histogramData.frequencies?.map((frequency, i) => ({
      name: histogramData?.boundaries?.[i],
      frequency,
    }));
  }, [data]);

  return (
    <Row className="w-full" gutter={[8, 8]}>
      <Col offset={3} span={24}>
        {getFormattedDateFromSeconds(data?.timestamp || 0, 'dd/MMM')}
      </Col>
      <Col offset={3} span={24}>
        <Tag>{`${t('label.skew')}: ${data?.nonParametricSkew || '--'}`}</Tag>
      </Col>
      <Col span={24}>
        <ResponsiveContainer
          debounce={200}
          id={`${name}_histogram`}
          minHeight={300}>
          <BarChart className="w-full" data={graphData} margin={{ left: 16 }}>
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
            <Tooltip formatter={(value: number) => tooltipFormatter(value)} />
            <Bar dataKey="frequency" fill="#1890FF" />
          </BarChart>
        </ResponsiveContainer>
      </Col>
    </Row>
  );
};

export default DataDistributionHistogram;

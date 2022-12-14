/*
 *  Copyright 2022 Collate
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

import { Col, Row } from 'antd';
import { uniqueId } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
} from 'recharts';
import { GRAPH_BACKGROUND_COLOR } from '../../constants/constants';
import { OPERATION_CHART_LEGEND_PAYLOAD } from '../../constants/profiler.constant';
import { formatNumberWithComma } from '../../utils/CommonUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import { CustomBarChartProps } from './Chart.interface';

const OperationDateBarChart = ({
  chartCollection,
  name,
}: CustomBarChartProps) => {
  const { data, information } = chartCollection;
  const { t } = useTranslation();

  const tooltipFormatter = (
    _value: number,
    _label: string,
    data: { payload: Record<string, number> }
  ) => {
    return formatNumberWithComma(data.payload.data);
  };

  if (data.length === 0) {
    return (
      <Row
        align="middle"
        className="h-full w-full"
        data-testid="no-data-placeholder"
        justify="center">
        <Col>
          <ErrorPlaceHolder>{t('label.no-data-available')}</ErrorPlaceHolder>
        </Col>
      </Row>
    );
  }

  return (
    <ResponsiveContainer debounce={200} id={`${name}_graph`} minHeight={300}>
      <ComposedChart className="w-full" data={data} margin={{ left: 16 }}>
        <XAxis
          dataKey="name"
          padding={{ left: 16, right: 16 }}
          tick={{ fontSize: 12 }}
        />
        <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} />
        <Tooltip formatter={tooltipFormatter} />
        {information.map((info) => (
          <Scatter
            dataKey={info.dataKey}
            fill={info.color}
            key={uniqueId()}
            name={info.title}
          />
        ))}
        {information.map((info) => (
          <Bar
            barSize={1}
            dataKey={info.dataKey}
            fill={info.color}
            key={uniqueId()}
            name={info.title}
            stackId="data"
          />
        ))}
        <Legend payload={OPERATION_CHART_LEGEND_PAYLOAD} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default OperationDateBarChart;

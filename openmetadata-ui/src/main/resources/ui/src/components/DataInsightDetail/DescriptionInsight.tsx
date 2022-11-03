/*
 *  Copyright 2021 Collate
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

import { Card, Typography } from 'antd';
import { random, uniqueId } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LegendProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BAR_CHART_MARGIN,
  DATA_INSIGHT_GRAPH_COLORS,
} from '../../constants/DataInsight.constants';
import { getEntityDescriptionData } from '../../pages/DataInsightPage/DataInsight.mock';
import { renderLegend } from '../../utils/DataInsightUtils';
import './DataInsightDetail.less';

const DescriptionInsight = () => {
  const { data, entities } = getEntityDescriptionData();
  const { t } = useTranslation();

  return (
    <Card
      className="data-insight-card"
      data-testid="entity-description-percentage-card"
      title={
        <Typography.Title level={5}>
          {t('label.data-insight-description-summary')}
        </Typography.Title>
      }>
      <ResponsiveContainer id="description-summary-graph" minHeight={400}>
        <BarChart data={data} margin={BAR_CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />

          <YAxis />
          <Tooltip />
          <Legend
            align="left"
            content={(props) => renderLegend(props as LegendProps, `65.8%`)}
            layout="vertical"
            verticalAlign="top"
            wrapperStyle={{ left: '0px' }}
          />
          {entities.map((entity) => (
            <Bar
              barSize={20}
              dataKey={entity}
              fill={
                DATA_INSIGHT_GRAPH_COLORS[
                  random(0, DATA_INSIGHT_GRAPH_COLORS.length)
                ]
              }
              key={uniqueId()}
              stackId="description"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default DescriptionInsight;

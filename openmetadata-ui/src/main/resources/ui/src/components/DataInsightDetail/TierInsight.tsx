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
import { uniqueId } from 'lodash';
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
  BAR_SIZE,
  TIER_BAR_COLOR_MAP,
} from '../../constants/DataInsight.constants';
import { getEntityTiersData } from '../../pages/DataInsightPage/DataInsight.mock';
import { CustomTooltip, renderLegend } from '../../utils/DataInsightUtils';
import './DataInsightDetail.less';

const TierInsight = () => {
  const { data, tiers } = getEntityTiersData();

  const { t } = useTranslation();

  return (
    <Card
      className="data-insight-card"
      data-testid="entity-summary-card-percentage"
      title={
        <>
          <Typography.Title level={5}>
            {t('label.data-insight-tier-summary')}
          </Typography.Title>
          <Typography.Text className="data-insight-label-text">
            Display the percentage of entities with tier by type.
          </Typography.Text>
        </>
      }>
      <ResponsiveContainer minHeight={400}>
        <BarChart data={data} margin={BAR_CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            align="left"
            content={(props) => renderLegend(props as LegendProps, `970`)}
            layout="vertical"
            verticalAlign="top"
            wrapperStyle={{ left: '0px' }}
          />
          {tiers.map((tier) => (
            <Bar
              barSize={BAR_SIZE}
              dataKey={tier}
              fill={TIER_BAR_COLOR_MAP[tier]}
              key={uniqueId()}
              stackId="tier"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default TierInsight;

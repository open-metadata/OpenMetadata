/*
 *  Copyright 2022 Collate.
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

import { Card, Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, uniqueId } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  LegendProps,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAggregateChartData } from 'rest/DataInsightAPI';
import {
  DEFAULT_CHART_OPACITY,
  GRAPH_BACKGROUND_COLOR,
  HOVER_CHART_OPACITY,
} from '../../constants/constants';
import {
  BAR_CHART_MARGIN,
  DI_STRUCTURE,
  TIER_BAR_COLOR_MAP,
  TIER_DATA,
} from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../../generated/dataInsight/dataInsightChartResult';
import { ChartFilter } from '../../interface/data-insight.interface';
import {
  axisTickFormatter,
  updateActiveChartFilter,
} from '../../utils/ChartUtils';
import {
  CustomTooltip,
  getGraphDataByTierType,
  renderLegend,
} from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';
import DataInsightProgressBar from './DataInsightProgressBar';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';

interface Props {
  chartFilter: ChartFilter;
  selectedDays: number;
}

const TierInsight: FC<Props> = ({ chartFilter, selectedDays }) => {
  const [totalEntitiesByTier, setTotalEntitiesByTier] =
    useState<DataInsightChartResult>();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [activeMouseHoverKey, setActiveMouseHoverKey] = useState('');

  const { data, tiers, total, relativePercentage, latestData } = useMemo(() => {
    return getGraphDataByTierType(totalEntitiesByTier?.data ?? []);
  }, [totalEntitiesByTier]);

  const { t } = useTranslation();

  const fetchTotalEntitiesByTier = async () => {
    setIsLoading(true);
    try {
      const params = {
        ...chartFilter,
        dataInsightChartName: DataInsightChartType.TotalEntitiesByTier,
        dataReportIndex: DataReportIndex.EntityReportDataIndex,
      };
      const response = await getAggregateChartData(params);

      setTotalEntitiesByTier(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLegendClick: LegendProps['onClick'] = (event) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(event.dataKey, prevActiveKeys)
    );
  };
  const handleLegendMouseEnter: LegendProps['onMouseEnter'] = (event) => {
    setActiveMouseHoverKey(event.dataKey);
  };
  const handleLegendMouseLeave: LegendProps['onMouseLeave'] = () => {
    setActiveMouseHoverKey('');
  };

  useEffect(() => {
    fetchTotalEntitiesByTier();
  }, [chartFilter]);

  return (
    <Card
      className="data-insight-card"
      data-testid="entity-summary-card-percentage"
      id={DataInsightChartType.TotalEntitiesByTier}
      loading={isLoading}
      title={
        <>
          <Typography.Title level={5}>
            {t('label.data-insight-tier-summary')}
          </Typography.Title>
          <Typography.Text className="data-insight-label-text">
            {t('message.field-insight', { field: 'tier' })}
          </Typography.Text>
        </>
      }>
      {data.length ? (
        <Row gutter={DI_STRUCTURE.rowContainerGutter}>
          <Col span={DI_STRUCTURE.leftContainerSpan}>
            <ResponsiveContainer debounce={1} minHeight={400}>
              <LineChart data={data} margin={BAR_CHART_MARGIN}>
                <CartesianGrid
                  stroke={GRAPH_BACKGROUND_COLOR}
                  vertical={false}
                />
                <XAxis dataKey="timestamp" />
                <YAxis
                  tickFormatter={(value) => axisTickFormatter(value, '%')}
                />
                <Tooltip content={<CustomTooltip isPercentage isTier />} />
                <Legend
                  align="left"
                  content={(props) =>
                    renderLegend(props as LegendProps, activeKeys, true)
                  }
                  layout="horizontal"
                  verticalAlign="top"
                  wrapperStyle={{ left: '0px', top: '0px' }}
                  onClick={handleLegendClick}
                  onMouseEnter={handleLegendMouseEnter}
                  onMouseLeave={handleLegendMouseLeave}
                />
                {tiers.map((tier) => (
                  <Line
                    dataKey={tier}
                    hide={
                      activeKeys.length && tier !== activeMouseHoverKey
                        ? !activeKeys.includes(tier)
                        : false
                    }
                    key={tier}
                    stroke={TIER_BAR_COLOR_MAP[tier]}
                    strokeOpacity={
                      isEmpty(activeMouseHoverKey) ||
                      tier === activeMouseHoverKey
                        ? DEFAULT_CHART_OPACITY
                        : HOVER_CHART_OPACITY
                    }
                    type="monotone"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Col>
          <Col span={DI_STRUCTURE.rightContainerSpan}>
            <Row gutter={DI_STRUCTURE.rightRowGutter}>
              <Col span={24}>
                <Typography.Paragraph
                  className="data-insight-label-text"
                  style={{ marginBottom: '4px' }}>
                  {t('label.assigned-entity', {
                    entity: t('label.tier'),
                  })}{' '}
                  %
                </Typography.Paragraph>
                <DataInsightProgressBar
                  changeInValue={relativePercentage}
                  className="m-b-md"
                  duration={selectedDays}
                  progress={Number(total)}
                  showLabel={false}
                />
              </Col>
              {tiers.map((tiers) => {
                return (
                  <Col key={uniqueId()} span={24}>
                    <DataInsightProgressBar
                      showEndValueAsLabel
                      progress={latestData[tiers]}
                      showLabel={false}
                      startValue={Number(latestData[tiers] || 0).toFixed(2)}
                      successValue={TIER_DATA[tiers as keyof typeof TIER_DATA]}
                    />
                  </Col>
                );
              })}
            </Row>
          </Col>
        </Row>
      ) : (
        <EmptyGraphPlaceholder />
      )}
    </Card>
  );
};

export default TierInsight;

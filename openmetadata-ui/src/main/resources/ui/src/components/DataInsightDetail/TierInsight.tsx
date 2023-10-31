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

import { Card, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, round } from 'lodash';
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
import {
  DEFAULT_CHART_OPACITY,
  GRAPH_BACKGROUND_COLOR,
  HOVER_CHART_OPACITY,
} from '../../constants/constants';
import {
  BAR_CHART_MARGIN,
  DI_STRUCTURE,
  TOTAL_ENTITY_CHART_COLOR,
} from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../../generated/dataInsight/dataInsightChartResult';
import { Tag } from '../../generated/entity/classification/tag';
import { ChartFilter } from '../../interface/data-insight.interface';
import { getAggregateChartData } from '../../rest/DataInsightAPI';
import {
  axisTickFormatter,
  updateActiveChartFilter,
} from '../../utils/ChartUtils';
import {
  CustomTooltip,
  getGraphDataByTierType,
  renderLegend,
} from '../../utils/DataInsightUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import PageHeader from '../PageHeader/PageHeader.component';
import './data-insight-detail.less';
import DataInsightProgressBar from './DataInsightProgressBar';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';
import EntitySummaryProgressBar from './EntitySummaryProgressBar.component';

interface Props {
  chartFilter: ChartFilter;
  selectedDays: number;
  tierTags: { tags: Tag[]; isLoading: boolean };
}

const TierInsight: FC<Props> = ({ chartFilter, selectedDays, tierTags }) => {
  const [totalEntitiesByTier, setTotalEntitiesByTier] =
    useState<DataInsightChartResult>();

  const [isLoading, setIsLoading] = useState<boolean>(true);
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
      const updatedRes = response.data?.map((data) => {
        const currentTier = tierTags.tags.find(
          (value) => value.fullyQualifiedName === data.entityTier
        );

        return {
          ...data,
          entityTier: getEntityName(currentTier) || data.entityTier,
        };
      });
      setTotalEntitiesByTier({ ...response, data: updatedRes });
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
    if (!tierTags.isLoading) {
      fetchTotalEntitiesByTier();
    }
  }, [chartFilter, tierTags]);

  return (
    <Card
      className="data-insight-card"
      data-testid="entity-summary-card-percentage"
      id={DataInsightChartType.TotalEntitiesByTier}
      loading={isLoading}
      title={
        <PageHeader
          data={{
            header: t('label.data-insight-tier-summary'),
            subHeader: t('message.field-insight', {
              field: t('label.tier'),
            }),
          }}
        />
      }>
      {data.length ? (
        <Row gutter={DI_STRUCTURE.rowContainerGutter}>
          <Col span={DI_STRUCTURE.leftContainerSpan}>
            <ResponsiveContainer
              debounce={1}
              id={`${DataInsightChartType.TotalEntitiesByTier}-graph`}
              minHeight={400}>
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
                    renderLegend(props as LegendProps, activeKeys)
                  }
                  layout="horizontal"
                  verticalAlign="top"
                  wrapperStyle={{ left: '0px', top: '0px' }}
                  onClick={handleLegendClick}
                  onMouseEnter={handleLegendMouseEnter}
                  onMouseLeave={handleLegendMouseLeave}
                />
                {tiers.map((tier, i) => (
                  <Line
                    dataKey={tier}
                    hide={
                      activeKeys.length && tier !== activeMouseHoverKey
                        ? !activeKeys.includes(tier)
                        : false
                    }
                    key={tier}
                    stroke={TOTAL_ENTITY_CHART_COLOR[i]}
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
                <DataInsightProgressBar
                  changeInValue={relativePercentage}
                  className="m-b-md"
                  duration={selectedDays}
                  label={`${t('label.assigned-entity', {
                    entity: t('label.tier'),
                  })} %`}
                  progress={Number(total)}
                  showLabel={false}
                />
              </Col>
              {tiers.map((tiers, i) => {
                return (
                  <Col key={tiers} span={24}>
                    <EntitySummaryProgressBar
                      entity={tiers}
                      label={round(latestData[tiers] || 0, 2) + '%'}
                      latestData={latestData}
                      pluralize={false}
                      progress={latestData[tiers]}
                      strokeColor={TOTAL_ENTITY_CHART_COLOR[i]}
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

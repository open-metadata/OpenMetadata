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

import { Button, Card, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { includes, isEmpty, round, toLower } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '../../components/header/PageHeader.component';
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
  sortEntityByValue,
} from '../../utils/DataInsightUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Searchbar from '../common/searchbar/Searchbar';
import './DataInsightDetail.less';
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
  const [searchEntityKeyWord, setSearchEntityKeyWord] = useState('');

  const { data, tiers, total, relativePercentage, latestData } = useMemo(() => {
    return getGraphDataByTierType(totalEntitiesByTier?.data ?? []);
  }, [totalEntitiesByTier]);
  const sortedEntitiesByValue = useMemo(() => {
    return sortEntityByValue(tiers, latestData);
  }, [tiers, latestData]);
  const rightSideEntityList = useMemo(
    () =>
      sortedEntitiesByValue.filter((entity) =>
        includes(toLower(entity), toLower(searchEntityKeyWord))
      ),
    [sortedEntitiesByValue, searchEntityKeyWord]
  );

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

  const handleLegendClick = (entity: string) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(entity, prevActiveKeys)
    );
  };

  const handleLegendMouseEnter = (entity: string) => {
    setActiveMouseHoverKey(entity);
  };
  const handleLegendMouseLeave = () => {
    setActiveMouseHoverKey('');
  };

  useEffect(() => {
    if (!tierTags.isLoading) {
      fetchTotalEntitiesByTier();
    }
  }, [chartFilter, tierTags]);

  if (isLoading || data.length === 0) {
    return (
      <Card
        className="data-insight-card"
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
        <EmptyGraphPlaceholder />
      </Card>
    );
  }

  return (
    <Card
      className="data-insight-card"
      data-testid="entity-summary-card-percentage"
      id={DataInsightChartType.TotalEntitiesByTier}
      loading={isLoading}>
      <Row gutter={DI_STRUCTURE.rowContainerGutter}>
        <Col span={DI_STRUCTURE.leftContainerSpan}>
          <PageHeader
            data={{
              header: t('label.data-insight-tier-summary'),
              subHeader: t('message.field-insight', {
                field: t('label.tier'),
              }),
            }}
          />
          <ResponsiveContainer
            debounce={1}
            height={500}
            id={`${DataInsightChartType.TotalEntitiesByTier}-graph`}>
            <LineChart data={data} margin={BAR_CHART_MARGIN}>
              <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} vertical={false} />
              <XAxis dataKey="timestamp" />
              <YAxis tickFormatter={(value) => axisTickFormatter(value, '%')} />
              <Tooltip
                content={<CustomTooltip isPercentage isTier />}
                wrapperStyle={{ pointerEvents: 'auto' }}
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
                    isEmpty(activeMouseHoverKey) || tier === activeMouseHoverKey
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
          <Row gutter={[8, 16]}>
            <Col span={24}>
              <DataInsightProgressBar
                changeInValue={relativePercentage}
                duration={selectedDays}
                label={`${t('label.assigned-entity', {
                  entity: t('label.tier'),
                })} %`}
                progress={Number(total)}
                showLabel={false}
              />
            </Col>
            <Col span={24}>
              <Searchbar
                removeMargin
                searchValue={searchEntityKeyWord}
                onSearch={setSearchEntityKeyWord}
              />
            </Col>
            <Col className="chart-card-right-panel-container" span={24}>
              <Row gutter={[8, 8]}>
                {rightSideEntityList.map((tier, i) => {
                  return (
                    <Col
                      className="entity-summary-container"
                      key={tier}
                      span={24}
                      onClick={() => handleLegendClick(tier)}
                      onMouseEnter={() => handleLegendMouseEnter(tier)}
                      onMouseLeave={handleLegendMouseLeave}>
                      <EntitySummaryProgressBar
                        entity={tier}
                        isActive={
                          activeKeys.length ? activeKeys.includes(tier) : true
                        }
                        label={round(latestData[tier] || 0, 2) + '%'}
                        latestData={latestData}
                        pluralize={false}
                        progress={latestData[tier]}
                        strokeColor={TOTAL_ENTITY_CHART_COLOR[i]}
                      />
                    </Col>
                  );
                })}
              </Row>
            </Col>
            {activeKeys.length > 0 && (
              <Col className="flex justify-end" span={24}>
                <Button type="link" onClick={() => setActiveKeys([])}>
                  {t('label.clear')}
                </Button>
              </Col>
            )}
          </Row>
        </Col>
      </Row>
    </Card>
  );
};

export default TierInsight;

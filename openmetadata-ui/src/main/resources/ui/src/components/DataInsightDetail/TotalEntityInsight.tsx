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
import { isEmpty } from 'lodash';
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
  GRAPH_HEIGHT,
  TOTAL_ENTITY_CHART_COLOR,
} from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../../generated/dataInsight/dataInsightChartResult';
import { ChartFilter } from '../../interface/data-insight.interface';
import { getAggregateChartData } from '../../rest/DataInsightAPI';
import { axisTickFormatter } from '../../utils/ChartUtils';
import {
  CustomTooltip,
  getGraphDataByEntityType,
  sortEntityByValue,
} from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';
import TotalEntityInsightSummary from './TotalEntityInsightSummary.component';

interface Props {
  chartFilter: ChartFilter;
  selectedDays: number;
}

const TotalEntityInsight: FC<Props> = ({ chartFilter, selectedDays }) => {
  const [totalEntitiesByType, setTotalEntitiesByType] =
    useState<DataInsightChartResult>();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [activeMouseHoverKey, setActiveMouseHoverKey] = useState('');

  const { data, entities, total, relativePercentage, latestData } =
    useMemo(() => {
      return getGraphDataByEntityType(
        totalEntitiesByType?.data ?? [],
        DataInsightChartType.TotalEntitiesByType
      );
    }, [totalEntitiesByType]);

  const { t } = useTranslation();
  const sortedEntitiesByValue = useMemo(() => {
    return sortEntityByValue(entities, latestData);
  }, [entities, latestData]);

  const fetchTotalEntitiesByType = async () => {
    setIsLoading(true);
    try {
      const params = {
        ...chartFilter,
        dataInsightChartName: DataInsightChartType.TotalEntitiesByType,
        dataReportIndex: DataReportIndex.EntityReportDataIndex,
      };
      const response = await getAggregateChartData(params);

      setTotalEntitiesByType(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTotalEntitiesByType();
  }, [chartFilter]);

  if (isLoading || data.length === 0) {
    return (
      <Card
        className="data-insight-card"
        loading={isLoading}
        title={
          <PageHeader
            data={{
              header: t('label.data-insight-total-entity-summary'),
              subHeader: t('message.total-entity-insight'),
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
      data-testid="entity-summary-card"
      id={DataInsightChartType.TotalEntitiesByType}
      loading={isLoading}>
      <Row gutter={DI_STRUCTURE.rowContainerGutter}>
        <Col span={DI_STRUCTURE.leftContainerSpan}>
          <PageHeader
            data={{
              header: t('label.data-insight-total-entity-summary'),
              subHeader: t('message.total-entity-insight'),
            }}
          />
          <ResponsiveContainer
            className="m-t-lg"
            debounce={1}
            height={GRAPH_HEIGHT}
            id="entity-summary-chart">
            <LineChart data={data} margin={BAR_CHART_MARGIN}>
              <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} vertical={false} />
              <XAxis dataKey="timestamp" />
              <YAxis tickFormatter={(value) => axisTickFormatter(value)} />
              <Tooltip
                content={<CustomTooltip />}
                wrapperStyle={{ pointerEvents: 'auto' }}
              />
              {entities.map((entity, i) => (
                <Line
                  dataKey={entity}
                  hide={
                    activeKeys.length && entity !== activeMouseHoverKey
                      ? !activeKeys.includes(entity)
                      : false
                  }
                  key={entity}
                  stroke={TOTAL_ENTITY_CHART_COLOR[i]}
                  strokeOpacity={
                    isEmpty(activeMouseHoverKey) ||
                    entity === activeMouseHoverKey
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
          <TotalEntityInsightSummary
            allowFilter
            activeKeys={activeKeys}
            entities={sortedEntitiesByValue}
            gutter={DI_STRUCTURE.rightRowGutter}
            latestData={latestData}
            relativePercentage={relativePercentage}
            selectedDays={selectedDays}
            total={total}
            onActiveKeyMouseHover={(entity) => setActiveMouseHoverKey(entity)}
            onActiveKeysUpdate={(entities) => setActiveKeys(entities)}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default TotalEntityInsight;

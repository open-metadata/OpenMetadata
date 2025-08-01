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
import { FC, useEffect, useMemo, useState } from 'react';
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
import {
  DEFAULT_CHART_OPACITY,
  GRAPH_BACKGROUND_COLOR,
  HOVER_CHART_OPACITY,
} from '../../constants/constants';
import {
  BAR_CHART_MARGIN,
  DI_STRUCTURE,
  GRAPH_HEIGHT,
} from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { PageViewsByEntities } from '../../generated/dataInsight/type/pageViewsByEntities';
import { ChartFilter } from '../../interface/data-insight.interface';
import { getAggregateChartData } from '../../rest/DataInsightAPI';
import { entityChartColor } from '../../utils/CommonUtils';
import {
  CustomTooltip,
  getGraphDataByEntityType,
  sortEntityByValue,
} from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import PageHeader from '../PageHeader/PageHeader.component';
import './data-insight-detail.less';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';
import TotalEntityInsightSummary from './TotalEntityInsightSummary.component';

interface Props {
  chartFilter: ChartFilter;
  selectedDays: number;
}

const PageViewsByEntitiesChart: FC<Props> = ({ chartFilter, selectedDays }) => {
  const [pageViewsByEntities, setPageViewsByEntities] =
    useState<PageViewsByEntities[]>();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [activeMouseHoverKey, setActiveMouseHoverKey] = useState('');

  const { data, entities, total, relativePercentage, latestData } =
    useMemo(() => {
      return getGraphDataByEntityType(
        pageViewsByEntities,
        DataInsightChartType.PageViewsByEntities
      );
    }, [pageViewsByEntities]);
  const sortedEntitiesByValue = useMemo(() => {
    return sortEntityByValue(entities, latestData);
  }, [entities, latestData]);

  const { t } = useTranslation();

  const fetchPageViewsByEntities = async () => {
    setIsLoading(true);
    try {
      const params = {
        ...chartFilter,
        dataInsightChartName: DataInsightChartType.PageViewsByEntities,
        dataReportIndex: DataReportIndex.WebAnalyticEntityViewReportDataIndex,
      };
      const response = await getAggregateChartData(params);

      setPageViewsByEntities(response.data ?? []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPageViewsByEntities();
  }, [chartFilter]);

  if (isLoading || data.length === 0) {
    return (
      <Card
        className="data-insight-card"
        data-testid="entity-page-views-card"
        loading={isLoading}
        title={
          <PageHeader
            data={{
              header: t('label.page-views-by-data-asset-plural'),
              subHeader: t('message.data-insight-page-views'),
            }}
          />
        }>
        <EmptyGraphPlaceholder />
      </Card>
    );
  }

  return (
    <Card
      className="data-insight-card data-insight-card-chart"
      data-testid="entity-page-views-card"
      id={DataInsightChartType.PageViewsByEntities}
      loading={isLoading}>
      <Row gutter={DI_STRUCTURE.rowContainerGutter}>
        <Col span={DI_STRUCTURE.leftContainerSpan}>
          <PageHeader
            data={{
              header: t('label.page-views-by-data-asset-plural'),
              subHeader: t('message.data-insight-page-views'),
            }}
          />
          <ResponsiveContainer debounce={1} height={GRAPH_HEIGHT}>
            <LineChart data={data} margin={BAR_CHART_MARGIN}>
              <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} vertical={false} />
              <XAxis dataKey="timestamp" />
              <YAxis />
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
                  stroke={entityChartColor(i)}
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

export default PageViewsByEntitiesChart;

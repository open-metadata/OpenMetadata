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
import { AxiosError } from 'axios';
import { uniqueId } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
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
import { getAggregateChartData } from '../../axiosAPIs/DataInsightAPI';
import {
  BAR_CHART_MARGIN,
  BAR_SIZE,
  ENTITIES_BAR_COLO_MAP,
} from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { PageViewsByEntities } from '../../generated/dataInsight/type/pageViewsByEntities';
import { ChartFilter } from '../../interface/data-insight.interface';
import {
  CustomTooltip,
  getGraphDataByEntityType,
  renderLegend,
} from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';

interface Props {
  chartFilter: ChartFilter;
}

const PageViewsByEntitiesChart: FC<Props> = ({ chartFilter }) => {
  const [pageViewsByEntities, setPageViewsByEntities] =
    useState<PageViewsByEntities[]>();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { data, entities, total } = useMemo(() => {
    return getGraphDataByEntityType(
      pageViewsByEntities,
      DataInsightChartType.PageViewsByEntities
    );
  }, [pageViewsByEntities]);

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

  return (
    <Card
      className="data-insight-card"
      data-testid="entity-page-views-card"
      id={DataInsightChartType.PageViewsByEntities}
      loading={isLoading}
      title={
        <>
          <Typography.Title level={5}>
            {t('label.page-views-by-entities')}
          </Typography.Title>
          <Typography.Text className="data-insight-label-text">
            {t('message.data-insight-page-views')}
          </Typography.Text>
        </>
      }>
      <ResponsiveContainer debounce={1} minHeight={400}>
        <BarChart data={data} margin={BAR_CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            align="left"
            content={(props) => renderLegend(props as LegendProps, `${total}`)}
            layout="vertical"
            verticalAlign="top"
            wrapperStyle={{ left: '0px' }}
          />
          {entities.map((entity) => (
            <Bar
              barSize={BAR_SIZE}
              dataKey={entity}
              fill={ENTITIES_BAR_COLO_MAP[entity]}
              key={uniqueId()}
              stackId="entityCount"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default PageViewsByEntitiesChart;

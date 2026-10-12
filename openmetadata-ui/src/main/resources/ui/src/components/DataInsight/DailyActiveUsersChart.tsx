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

import { Grid } from '@openmetadata/ui-core-components';
import { LineChart } from '@openmetadata/ui-core-components/charts';
import { Card } from 'antd';
import { AxiosError } from 'axios';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DI_STRUCTURE,
  GRAPH_HEIGHT,
} from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { DailyActiveUsers } from '../../generated/dataInsight/type/dailyActiveUsers';
import { ChartFilter } from '../../interface/data-insight.interface';
import { getAggregateChartData } from '../../rest/DataInsightAPI';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import {
  getDataInsightTooltip,
  HIDDEN_CHART_LEGEND,
} from '../../utils/DataInsightChartUtils';
import { getFormattedActiveUsersData } from '../../utils/DataInsightPureUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import PageHeader from '../PageHeader/PageHeader.component';
import CustomStatistic from './CustomStatistic';
import './data-insight-detail.less';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';
interface Props {
  chartFilter: ChartFilter;
  selectedDays: number;
}

const DailyActiveUsersChart: FC<Props> = ({ chartFilter, selectedDays }) => {
  const [dailyActiveUsers, setDailyActiveUsers] = useState<DailyActiveUsers[]>(
    []
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { t } = useTranslation();

  const { data, total, relativePercentage } = useMemo(
    () => getFormattedActiveUsersData(dailyActiveUsers),
    [dailyActiveUsers]
  );

  const series = useMemo(
    () => [{ key: 'activeUsers', name: t('label.active-user') }],
    [t]
  );
  const tooltip = useMemo(
    () => getDataInsightTooltip({ timeKey: 'timestampValue' }),
    []
  );

  const fetchPageViewsByEntities = async () => {
    setIsLoading(true);
    try {
      const params = {
        ...chartFilter,
        dataInsightChartName: DataInsightChartType.DailyActiveUsers,
        dataReportIndex: DataReportIndex.WebAnalyticUserActivityReportDataIndex,
      };
      const response = await getAggregateChartData(params);

      setDailyActiveUsers(response.data ?? []);
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
      className="data-insight-card data-insight-card-chart"
      data-testid="entity-active-user-card"
      id={DataInsightChartType.DailyActiveUsers}
      loading={isLoading}
      title={
        <PageHeader
          data={{
            header: t('label.daily-active-users-on-the-platform'),
            subHeader: t('message.active-users'),
          }}
        />
      }>
      {dailyActiveUsers.length ? (
        <Grid className="layout-row layout-grid" style={getLayoutGutter(32)}>
          <Grid.Item
            className="layout-column"
            span={DI_STRUCTURE.leftContainerSpan}>
            <LineChart
              ariaLabel={t('label.daily-active-users-on-the-platform')}
              data={data}
              height={GRAPH_HEIGHT}
              legend={HIDDEN_CHART_LEGEND}
              series={series}
              tooltip={tooltip}
              xKey="timestamp"
            />
          </Grid.Item>
          <Grid.Item
            className="layout-column"
            span={DI_STRUCTURE.rightContainerSpan}>
            <CustomStatistic
              changeInValue={relativePercentage}
              duration={selectedDays}
              label={t('label.total-entity', {
                entity: t('label.active-user'),
              })}
              value={total}
            />
          </Grid.Item>
        </Grid>
      ) : (
        <EmptyGraphPlaceholder />
      )}
    </Card>
  );
};

export default DailyActiveUsersChart;

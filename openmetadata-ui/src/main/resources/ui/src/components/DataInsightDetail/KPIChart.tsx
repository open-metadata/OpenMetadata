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

import { Button, Card, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getListKpiResult, getListKPIs } from '../../axiosAPIs/KpiAPI';
import { ROUTES } from '../../constants/constants';
import {
  BAR_CHART_MARGIN,
  DATA_INSIGHT_GRAPH_COLORS,
} from '../../constants/DataInsight.constants';
import { Kpi, KpiResult } from '../../generated/dataInsight/kpi/kpi';
import { ChartFilter } from '../../interface/data-insight.interface';
import { CustomTooltip, getKpiGraphData } from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';

interface Props {
  chartFilter: ChartFilter;
}

const KPIChart: FC<Props> = ({ chartFilter }) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const [kpiResults, setKpiResults] = useState<KpiResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAddKpi = () => history.push(ROUTES.ADD_KPI);
  const handleListKpi = () => history.push(ROUTES.KPI_LIST);

  const fetchKpiList = async () => {
    try {
      setIsLoading(true);
      const response = await getListKPIs();
      setKpiList(response.data);
    } catch (_err) {
      setKpiList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKpiResults = async () => {
    setIsLoading(true);
    try {
      const promises = kpiList.map((kpi) =>
        getListKpiResult(kpi.fullyQualifiedName ?? '', {
          startTs: chartFilter.startTs,
          endTs: chartFilter.endTs,
        })
      );
      const responses = await Promise.allSettled(promises);

      responses.forEach((response) => {
        if (response.status === 'fulfilled') {
          setKpiResults((previous) => [...previous, ...response.value.data]);
        }
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const { kpis, graphData } = useMemo(
    () => getKpiGraphData(kpiResults),
    [kpiResults]
  );

  useEffect(() => {
    fetchKpiList();
  }, []);

  useEffect(() => {
    setKpiResults([]);
  }, [chartFilter]);

  useEffect(() => {
    if (kpiList.length) {
      fetchKpiResults();
    }
  }, [kpiList, chartFilter]);

  const addKpiPlaceholder = (
    <Space className="w-full justify-center items-center" direction="vertical">
      <Typography.Text>
        {t('message.no-kpi-available-add-new-one')}
      </Typography.Text>
      <Button
        className="tw-border-primary tw-text-primary"
        type="default"
        onClick={handleAddKpi}>
        {t('label.add-kpi')}
      </Button>
    </Space>
  );

  return (
    <Card
      className="data-insight-card"
      data-testid="kpi-card"
      id="kpi-charts"
      loading={isLoading}
      title={
        <Space className="w-full justify-between">
          <div>
            <Typography.Title level={5}>
              {t('label.kpi-title')}
            </Typography.Title>
            <Typography.Text className="data-insight-label-text">
              {t('label.kpi-subtitle')}
            </Typography.Text>
          </div>
          <Button onClick={handleListKpi}>View All KPI&apos;s</Button>
        </Space>
      }>
      {kpiList.length ? (
        <ResponsiveContainer debounce={1} minHeight={400}>
          <LineChart data={graphData} margin={BAR_CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            {kpis.map((kpi, i) => (
              <Line
                dataKey={kpi}
                key={i}
                stroke={DATA_INSIGHT_GRAPH_COLORS[i]}
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        addKpiPlaceholder
      )}
    </Card>
  );
};

export default KPIChart;

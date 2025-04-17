/*
 *  Copyright 2024 Collate.
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
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as HealthCheckIcon } from '../../../../assets/svg/ic-green-heart-border.svg';
import {
  GREEN_3,
  RED_3,
  TEXT_COLOR,
} from '../../../../constants/Color.constants';
import { TEXT_GREY_MUTED } from '../../../../constants/constants';
import { INITIAL_ENTITY_HEALTH_MATRIX } from '../../../../constants/profiler.constant';
import { fetchEntityCoveredWithDQ } from '../../../../rest/dataQualityDashboardAPI';
import CustomPieChart from '../../../Visualisations/Chart/CustomPieChart.component';
import { PieChartWidgetCommonProps } from '../../DataQuality.interface';

const EntityHealthStatusPieChartWidget = ({
  className = '',
  chartFilter,
}: PieChartWidgetCommonProps) => {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [entityHealthStates, setEntityHealthStates] = useState<{
    healthy: number;
    unhealthy: number;
    total: number;
  }>(INITIAL_ENTITY_HEALTH_MATRIX);

  const { data, chartLabel } = useMemo(
    () => ({
      data: [
        {
          name: t('label.healthy'),
          value: entityHealthStates.healthy,
          color: GREEN_3,
        },
        {
          name: t('label.unhealthy'),
          value: entityHealthStates.unhealthy,
          color: RED_3,
        },
      ],
      chartLabel: (
        <>
          <text
            dy={8}
            fill={TEXT_GREY_MUTED}
            fontSize={16}
            textAnchor="middle"
            x="50%"
            y="46%">
            <tspan fill={TEXT_COLOR}>{entityHealthStates.healthy}</tspan>
            {`/${entityHealthStates.total}`}
          </text>
          <text
            dy={8}
            fill={TEXT_GREY_MUTED}
            textAnchor="middle"
            x="50%"
            y="54%">
            {t('label.entity-plural')}
          </text>
        </>
      ),
    }),
    [entityHealthStates]
  );

  const fetchEntityHealthSummary = async () => {
    setIsLoading(true);
    try {
      const { data: unhealthyData } = await fetchEntityCoveredWithDQ(
        chartFilter,
        true
      );
      const { data: totalData } = await fetchEntityCoveredWithDQ(
        chartFilter,
        false
      );
      if (unhealthyData.length === 0 || totalData.length === 0) {
        setEntityHealthStates(INITIAL_ENTITY_HEALTH_MATRIX);
      }
      const unhealthy = parseInt(unhealthyData[0].originEntityFQN);
      const total = parseInt(totalData[0].originEntityFQN);

      setEntityHealthStates({ unhealthy, healthy: total - unhealthy, total });
    } catch {
      setEntityHealthStates(INITIAL_ENTITY_HEALTH_MATRIX);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntityHealthSummary();
  }, [chartFilter]);

  return (
    <Card className={className} loading={isLoading}>
      <div className="d-flex flex-column items-center">
        <div className="d-flex items-center gap-2">
          <HealthCheckIcon height={20} width={20} />
          <Typography.Text className="font-medium text-md">
            {t('label.healthy-data-asset-plural')}
          </Typography.Text>
        </div>
        <CustomPieChart
          data={data}
          label={chartLabel}
          name="healthy-data-assets"
        />
      </div>
    </Card>
  );
};

export default EntityHealthStatusPieChartWidget;

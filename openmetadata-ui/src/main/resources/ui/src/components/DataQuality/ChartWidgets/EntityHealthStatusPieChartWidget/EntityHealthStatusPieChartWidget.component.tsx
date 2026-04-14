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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as HealthCheckIcon } from '../../../../assets/svg/ic-green-heart-border.svg';
import { GREEN_3, RED_3 } from '../../../../constants/Color.constants';
import { INITIAL_ENTITY_HEALTH_MATRIX } from '../../../../constants/profiler.constant';
import { fetchEntityCoveredWithDQ } from '../../../../rest/dataQualityDashboardAPI';
import {
  getPieChartLabel,
  getTestCaseTabPath,
} from '../../../../utils/DataQuality/DataQualityUtils';
import type { CustomPieChartData } from '../../../Visualisations/Chart/Chart.interface';
import CustomPieChart from '../../../Visualisations/Chart/CustomPieChart.component';
import { PieChartWidgetCommonProps } from '../../DataQuality.interface';
import '../chart-widgets.less';
import { BINARY_STATUS_PIE_SEGMENT_ORDER } from '../ChartWidgets.constants';

const EntityHealthStatusPieChartWidget = ({
  className = '',
  chartFilter,
}: PieChartWidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [entityHealthStates, setEntityHealthStates] = useState<{
    healthy: number;
    unhealthy: number;
    total: number;
  }>(INITIAL_ENTITY_HEALTH_MATRIX);

  const handleSegmentClick = useCallback(
    (_entry: CustomPieChartData, index: number) => {
      const status = BINARY_STATUS_PIE_SEGMENT_ORDER[index];
      if (status) {
        navigate(getTestCaseTabPath(status));
      }
    },
    [navigate]
  );

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
      chartLabel: getPieChartLabel(
        t('label.entity-plural'),
        entityHealthStates.total
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

        return;
      }
      const unhealthy = parseInt(unhealthyData[0].originEntityFQN, 10);
      const total = parseInt(totalData[0].originEntityFQN, 10);

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
          <div className="custom-chart-icon-background health-check-icon icon-container">
            <HealthCheckIcon />
          </div>
          <Typography.Text className="font-medium text-md">
            {t('label.healthy-data-asset-plural')}
          </Typography.Text>
        </div>
        <CustomPieChart
          showLegends
          data={data}
          label={chartLabel}
          name="healthy-data-assets"
          onSegmentClick={handleSegmentClick}
        />
      </div>
    </Card>
  );
};

export default EntityHealthStatusPieChartWidget;

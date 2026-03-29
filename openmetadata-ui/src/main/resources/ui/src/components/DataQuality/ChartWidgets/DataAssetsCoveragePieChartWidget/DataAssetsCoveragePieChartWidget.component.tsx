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
import { parseInt } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DataAssetsCoverageIcon } from '../../../../assets/svg/ic-data-assets-coverage.svg';
import { GREEN_3, RED_3 } from '../../../../constants/Color.constants';
import { ROUTES } from '../../../../constants/constants';
import { INITIAL_DATA_ASSETS_COVERAGE_STATES } from '../../../../constants/profiler.constant';
import { DataQualityPageTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import {
  fetchEntityCoveredWithDQ,
  fetchTotalEntityCount,
} from '../../../../rest/dataQualityDashboardAPI';
import { getPieChartLabel } from '../../../../utils/DataQuality/DataQualityUtils';
import { getDataQualityPagePath } from '../../../../utils/RouterUtils';
import type { CustomPieChartData } from '../../../Visualisations/Chart/Chart.interface';
import CustomPieChart from '../../../Visualisations/Chart/CustomPieChart.component';
import { PieChartWidgetCommonProps } from '../../DataQuality.interface';
import '../chart-widgets.less';

const DataAssetsCoveragePieChartWidget = ({
  className = '',
  chartFilter,
}: PieChartWidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [dataAssetsCoverageStates, setDataAssetsCoverageStates] = useState<{
    covered: number;
    notCovered: number;
    total: number;
  }>(INITIAL_DATA_ASSETS_COVERAGE_STATES);

  const handleSegmentClick = useCallback(
    (_entry: CustomPieChartData, index: number) => {
      if (index === 0) {
        navigate(getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES));
      } else if (index === 1) {
        navigate(ROUTES.EXPLORE);
      }
    },
    [navigate]
  );

  const { data, chartLabel } = useMemo(
    () => ({
      data: [
        {
          name: t('label.covered'),
          value: dataAssetsCoverageStates.covered,
          color: GREEN_3,
        },
        {
          name: t('label.not-covered'),
          value: dataAssetsCoverageStates.notCovered,
          color: RED_3,
        },
      ],
      chartLabel: getPieChartLabel(
        t('label.table-plural'),
        dataAssetsCoverageStates.total
      ),
    }),
    [dataAssetsCoverageStates]
  );

  const fetchDataAssetsCoverage = async () => {
    setIsLoading(true);
    try {
      const { data: coverageData } = await fetchEntityCoveredWithDQ(
        chartFilter,
        false
      );
      const { data: totalData } = await fetchTotalEntityCount(chartFilter);
      if (coverageData.length === 0 || totalData.length === 0) {
        setDataAssetsCoverageStates(INITIAL_DATA_ASSETS_COVERAGE_STATES);

        return;
      }

      const covered = parseInt(coverageData[0].originEntityFQN, 10);
      let total = parseInt(totalData[0].fullyQualifiedName, 10);

      if (covered > total) {
        total = covered;
      }

      setDataAssetsCoverageStates({
        covered,
        notCovered: total - covered,
        total: total,
      });
    } catch {
      setDataAssetsCoverageStates(INITIAL_DATA_ASSETS_COVERAGE_STATES);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDataAssetsCoverage();
  }, [chartFilter]);

  return (
    <Card className={className} loading={isLoading}>
      <div className="d-flex flex-column items-center">
        <div className="d-flex items-center gap-2">
          <div className="custom-chart-icon-background data-assets-coverage-icon icon-container">
            <DataAssetsCoverageIcon />
          </div>
          <Typography.Text className="font-medium text-md">
            {t('label.data-asset-plural-coverage')}
          </Typography.Text>
        </div>
        <CustomPieChart
          showLegends
          data={data}
          label={chartLabel}
          name="data-assets-coverage"
          onSegmentClick={handleSegmentClick}
        />
      </div>
    </Card>
  );
};

export default DataAssetsCoveragePieChartWidget;

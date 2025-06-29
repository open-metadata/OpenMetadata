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
import { ReactComponent as DataAssetsCoverageIcon } from '../../../../assets/svg/ic-data-assets-coverage.svg';
import {
  GREEN_3,
  RED_3,
  TEXT_COLOR,
} from '../../../../constants/Color.constants';
import { TEXT_GREY_MUTED } from '../../../../constants/constants';
import { INITIAL_DATA_ASSETS_COVERAGE_STATES } from '../../../../constants/profiler.constant';
import {
  fetchEntityCoveredWithDQ,
  fetchTotalEntityCount,
} from '../../../../rest/dataQualityDashboardAPI';
import CustomPieChart from '../../../Visualisations/Chart/CustomPieChart.component';
import { PieChartWidgetCommonProps } from '../../DataQuality.interface';

const DataAssetsCoveragePieChartWidget = ({
  className = '',
  chartFilter,
}: PieChartWidgetCommonProps) => {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [dataAssetsCoverageStates, setDataAssetsCoverageStates] = useState<{
    covered: number;
    notCovered: number;
    total: number;
  }>(INITIAL_DATA_ASSETS_COVERAGE_STATES);

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
      chartLabel: (
        <>
          <text
            dy={8}
            fill={TEXT_GREY_MUTED}
            fontSize={16}
            textAnchor="middle"
            x="50%"
            y="46%">
            <tspan fill={TEXT_COLOR}>{dataAssetsCoverageStates.covered}</tspan>
            {`/${dataAssetsCoverageStates.total}`}
          </text>
          <text
            dy={8}
            fill={TEXT_GREY_MUTED}
            textAnchor="middle"
            x="50%"
            y="54%">
            {t('label.table-plural')}
          </text>
        </>
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
      }

      const covered = parseInt(coverageData[0].originEntityFQN);
      let total = parseInt(totalData[0].fullyQualifiedName);

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
          <DataAssetsCoverageIcon height={20} width={20} />
          <Typography.Text className="font-medium text-md">
            {t('label.data-asset-plural-coverage')}
          </Typography.Text>
        </div>
        <CustomPieChart
          data={data}
          label={chartLabel}
          name="data-assets-coverage"
        />
      </div>
    </Card>
  );
};

export default DataAssetsCoveragePieChartWidget;

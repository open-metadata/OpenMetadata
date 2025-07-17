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
import { Col, Row } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AllTestsIcon } from '../../../assets/svg/all-activity-v2.svg';
import { ReactComponent as DataAssetsCoverageIcon } from '../../../assets/svg/ic-data-assets-coverage.svg';
import { ReactComponent as HealthCheckIcon } from '../../../assets/svg/ic-green-heart-border.svg';
import {
  BLUE_2,
  GREEN_3,
  GREY_200,
  RED_3,
  YELLOW_2,
} from '../../../constants/Color.constants';
import { calculatePercentage } from '../../../utils/CommonUtils';
import { SummaryPanelProps } from './SummaryPanel.interface';
import SummaryPieChartCard from './SummaryPieChartCard/SummaryPieChartCard.component';

const PieChartSummaryPanel = ({
  testSummary,
  isLoading = false,
  showAdditionalSummary = true,
}: SummaryPanelProps) => {
  const { t } = useTranslation();
  const {
    total: totalTests = 0,
    success: successTests = 0,
    failed: failedTests = 0,
    aborted: abortedTests = 0,
    healthy: healthyDataAssets = 0,
    totalDQEntities = 0,
    totalEntityCount = 0,
  } = testSummary || {};

  const testData = useMemo(
    () => [
      { name: 'Success', value: successTests, color: GREEN_3 },
      { name: 'Aborted', value: abortedTests, color: YELLOW_2 },
      { name: 'Failed', value: failedTests, color: RED_3 },
    ],
    [successTests, abortedTests, failedTests]
  );

  const healthyData = useMemo(
    () => [
      { name: 'Healthy', value: healthyDataAssets, color: GREEN_3 },
      {
        name: 'Unhealthy',
        value: totalDQEntities - healthyDataAssets,
        color: GREY_200,
      },
    ],
    [healthyDataAssets, totalDQEntities]
  );

  const coverageData = useMemo(
    () => [
      { name: 'Covered', value: totalDQEntities, color: BLUE_2 },
      {
        name: 'Uncovered',
        value: totalEntityCount - totalDQEntities,
        color: GREY_200,
      },
    ],
    [totalDQEntities, totalEntityCount]
  );

  const percentages = useMemo(
    () => ({
      testSuccess: calculatePercentage(successTests, totalTests),
      healthy: calculatePercentage(healthyDataAssets, totalDQEntities),
      coverage: calculatePercentage(totalDQEntities, totalEntityCount),
    }),
    [
      successTests,
      totalTests,
      healthyDataAssets,
      totalDQEntities,
      totalEntityCount,
    ]
  );

  return (
    <Row gutter={[16, 16]}>
      <Col md={8} sm={24} xs={24}>
        <SummaryPieChartCard
          showLegends
          chartData={testData}
          iconData={{
            icon: <AllTestsIcon />,
            className: 'all-tests-icon',
          }}
          isLoading={isLoading}
          paddingAngle={2}
          percentage={percentages.testSuccess}
          title={t('label.total-entity', {
            entity: t('label.test-plural'),
          })}
          value={totalTests}
        />
      </Col>

      {showAdditionalSummary && (
        <>
          <Col md={8} sm={24} xs={24}>
            <SummaryPieChartCard
              chartData={healthyData}
              iconData={{
                icon: <HealthCheckIcon />,
                className: 'health-check-icon',
              }}
              isLoading={isLoading}
              percentage={percentages.healthy}
              title={t('label.healthy-data-asset-plural')}
              value={healthyDataAssets}
            />
          </Col>

          <Col md={8} sm={24} xs={24}>
            <SummaryPieChartCard
              chartData={coverageData}
              iconData={{
                icon: <DataAssetsCoverageIcon />,
                className: 'data-assets-coverage-icon',
              }}
              isLoading={isLoading}
              percentage={percentages.coverage}
              title={t('label.data-asset-plural-coverage')}
              value={totalDQEntities}
            />
          </Col>
        </>
      )}
    </Row>
  );
};

export default PieChartSummaryPanel;

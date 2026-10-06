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
import type { ChartStatus } from '@openmetadata/ui-core-components/charts';
import { Col, Row } from 'antd';
import { ReactNode } from 'react';
import { ReactComponent as AllTestsIcon } from '../../../assets/svg/all-activity-v2.svg';
import { ReactComponent as DataAssetsCoverageIcon } from '../../../assets/svg/ic-data-assets-coverage.svg';
import { ReactComponent as HealthCheckIcon } from '../../../assets/svg/ic-green-heart-border.svg';
import {
  SummaryPanelProps,
  TestSummaryCardKey,
  TestSummarySegmentId,
} from './SummaryPanel.interface';
import SummaryPieChartCard from './SummaryPieChartCard/SummaryPieChartCard.component';
import { useTestSummaryCards } from './useTestSummaryCards';

const SEGMENT_STATUS: Record<TestSummarySegmentId, ChartStatus> = {
  [TestSummarySegmentId.Success]: 'success',
  [TestSummarySegmentId.Aborted]: 'warning',
  [TestSummarySegmentId.Failed]: 'failed',
  [TestSummarySegmentId.Healthy]: 'success',
  [TestSummarySegmentId.Unhealthy]: 'neutral',
  [TestSummarySegmentId.Covered]: 'info',
  [TestSummarySegmentId.Uncovered]: 'neutral',
};

const CARD_ICONS: Record<
  TestSummaryCardKey,
  { icon: ReactNode; className: string }
> = {
  [TestSummaryCardKey.TotalTests]: {
    icon: <AllTestsIcon />,
    className: 'all-tests-icon',
  },
  [TestSummaryCardKey.Healthy]: {
    icon: <HealthCheckIcon />,
    className: 'health-check-icon',
  },
  [TestSummaryCardKey.Coverage]: {
    icon: <DataAssetsCoverageIcon />,
    className: 'data-assets-coverage-icon',
  },
};

const PieChartSummaryPanel = ({
  testSummary,
  isLoading = false,
  showAdditionalSummary = true,
}: SummaryPanelProps) => {
  const cards = useTestSummaryCards(testSummary);
  const visibleCards = showAdditionalSummary ? cards : cards.slice(0, 1);

  return (
    <Row gutter={[16, 16]}>
      {visibleCards.map((card) => {
        const isTotalTests = card.key === TestSummaryCardKey.TotalTests;

        return (
          <Col key={card.key} md={8} sm={24} xs={24}>
            <SummaryPieChartCard
              chartData={card.segments.map((segment) => ({
                name: segment.name,
                value: segment.value,
                status: SEGMENT_STATUS[segment.id],
              }))}
              iconData={CARD_ICONS[card.key]}
              isLoading={isLoading}
              paddingAngle={isTotalTests ? 2 : 0}
              percentage={card.percentage}
              showLegends={isTotalTests}
              title={card.title}
              value={card.value}
            />
          </Col>
        );
      })}
    </Row>
  );
};

export default PieChartSummaryPanel;

/*
 *  Copyright 2026 Collate.
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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TestSummary } from '../../../generated/tests/testSuite';
import { calculatePercentage } from '../../../utils/NumberUtils';
import {
  TestSummaryCard,
  TestSummaryCardKey,
  TestSummarySegmentId,
} from './SummaryPanel.interface';

/**
 * Derives the three Data Quality summary cards (Total Tests, Healthy Data
 * Assets, Coverage) from a `TestSummary`. This is the data-shaping layer shared
 * by the OSS `PieChartSummaryPanel` and the AI `DqSummaryPanel`; each renderer
 * supplies its own colour palette and chrome. Segments carry stable ids so a
 * consumer can map id -> colour.
 */
export const useTestSummaryCards = (
  testSummary: TestSummary
): TestSummaryCard[] => {
  const { t } = useTranslation();

  return useMemo<TestSummaryCard[]>(() => {
    const {
      total: totalTests = 0,
      success: successTests = 0,
      failed: failedTests = 0,
      aborted: abortedTests = 0,
      healthy: healthyDataAssets = 0,
      totalDQEntities = 0,
      totalEntityCount = 0,
    } = testSummary || {};

    return [
      {
        key: TestSummaryCardKey.TotalTests,
        title: t('label.total-entity', { entity: t('label.test-plural') }),
        value: totalTests,
        percentage: calculatePercentage(successTests, totalTests, 2, true),
        segments: [
          {
            id: TestSummarySegmentId.Success,
            name: t('label.success'),
            value: successTests,
          },
          {
            id: TestSummarySegmentId.Aborted,
            name: t('label.aborted'),
            value: abortedTests,
          },
          {
            id: TestSummarySegmentId.Failed,
            name: t('label.failed'),
            value: failedTests,
          },
        ],
      },
      {
        key: TestSummaryCardKey.Healthy,
        title: t('label.healthy-data-asset-plural'),
        value: healthyDataAssets,
        percentage: calculatePercentage(
          healthyDataAssets,
          totalDQEntities,
          2,
          true
        ),
        segments: [
          {
            id: TestSummarySegmentId.Healthy,
            name: t('label.healthy'),
            value: healthyDataAssets,
          },
          {
            id: TestSummarySegmentId.Unhealthy,
            name: t('label.unhealthy'),
            value: totalDQEntities - healthyDataAssets,
          },
        ],
      },
      {
        key: TestSummaryCardKey.Coverage,
        title: t('label.data-asset-plural-coverage'),
        value: totalDQEntities,
        percentage: calculatePercentage(
          totalDQEntities,
          totalEntityCount,
          2,
          true
        ),
        segments: [
          {
            id: TestSummarySegmentId.Covered,
            name: t('label.covered'),
            value: totalDQEntities,
          },
          {
            id: TestSummarySegmentId.Uncovered,
            name: t('label.uncovered'),
            value: totalEntityCount - totalDQEntities,
          },
        ],
      },
    ];
  }, [t, testSummary]);
};

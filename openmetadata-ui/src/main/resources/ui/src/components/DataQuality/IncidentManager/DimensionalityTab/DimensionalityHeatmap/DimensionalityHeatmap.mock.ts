/*
 *  Copyright 2025 Collate.
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

import { TestCaseStatus } from '../../../../../generated/tests/dimensionResult';
import { DimensionResultWithTimestamp } from './DimensionalityHeatmap.interface';

export const generateMockDimensionResults = (
  dimensionValues: string[],
  startTs: number,
  endTs: number
): DimensionResultWithTimestamp[] => {
  const results: DimensionResultWithTimestamp[] = [];
  const startDate = new Date(startTs);
  const endDate = new Date(endTs);
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dimensionValues.forEach((value) => {
      const dataPointsPerDay = Math.floor(Math.random() * 2) + 3;

      for (let i = 0; i < dataPointsPerDay; i++) {
        const random = Math.random();
        let status: TestCaseStatus;
        let passedRows: number;
        let failedRows: number;

        if (random < 0.7) {
          status = TestCaseStatus.Success;
          passedRows = Math.floor(Math.random() * 9000) + 1000;
          failedRows = 0;
        } else if (random < 0.95) {
          status = TestCaseStatus.Failed;
          passedRows = Math.floor(Math.random() * 5000) + 1000;
          failedRows = Math.floor(Math.random() * 1000) + 100;
        } else {
          status = TestCaseStatus.Aborted;
          passedRows = 0;
          failedRows = 0;
        }

        const totalRows = passedRows + failedRows;
        const passedRowsPercentage =
          totalRows > 0 ? (passedRows / totalRows) * 100 : 0;
        const failedRowsPercentage =
          totalRows > 0 ? (failedRows / totalRows) * 100 : 0;

        const hourOffset = i * (24 / dataPointsPerDay);
        const timestamp =
          new Date(currentDate).getTime() + hourOffset * 60 * 60 * 1000;

        results.push({
          dimensionValues: [
            {
              name: 'name',
              value: value,
            },
          ],
          dimensionKey: `name=${value}`,
          testCaseStatus: status,
          timestamp,
          passedRows,
          failedRows,
          passedRowsPercentage,
          failedRowsPercentage,
          impactScore: Math.random() * 100,
          result:
            status === TestCaseStatus.Failed
              ? `Dimension name=${value}: Failed`
              : `Dimension name=${value}: Passed`,
          testResultValue: [],
        });
      }
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return results;
};

export const MOCK_DIMENSION_VALUES = [
  'ApplicationBotPolicy',
  'AutoClassificationBotPolicy',
  'DataConsumerPolicy',
  'DataStewardPolicy',
  'OrganizationPolicy',
  'Others',
];

export const getMockDimensionResults = (
  startTs: number,
  endTs: number
): DimensionResultWithTimestamp[] => {
  return generateMockDimensionResults(MOCK_DIMENSION_VALUES, startTs, endTs);
};

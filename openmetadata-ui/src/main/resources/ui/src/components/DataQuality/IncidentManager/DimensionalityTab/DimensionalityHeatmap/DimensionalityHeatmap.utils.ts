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

import { format } from 'date-fns';
import { TestCaseStatus } from '../../../../../generated/tests/dimensionResult';
import {
  DimensionResultWithTimestamp,
  HeatmapCellData,
  HeatmapRowData,
  HeatmapStatus,
} from './DimensionalityHeatmap.interface';

/**
 * Generates an array of dates in chronological order (oldest first, newest last)
 * Used to create the horizontal axis of the heatmap
 *
 * @param startTs - Start timestamp in milliseconds
 * @param endTs - End timestamp in milliseconds
 * @returns Array of date strings in 'yyyy-MM-dd' format, chronological order (oldest to newest)
 * @throws {Error} If startTs is greater than endTs or if either timestamp is invalid
 */
export const generateDateRange = (startTs: number, endTs: number): string[] => {
  // Validate timestamps
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
    throw new TypeError('Invalid timestamp: timestamps must be finite numbers');
  }

  if (startTs > endTs) {
    throw new TypeError(
      `Invalid date range: start date (${new Date(
        startTs
      ).toISOString()}) must be before or equal to end date (${new Date(
        endTs
      ).toISOString()})`
    );
  }

  const dates: string[] = [];
  const startDate = new Date(startTs);
  const endDate = new Date(endTs);

  // Validate that dates are valid
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new TypeError('Invalid timestamp: unable to create valid dates');
  }

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(format(currentDate, 'yyyy-MM-dd'));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

export const mapStatusToHeatmapStatus = (
  status: TestCaseStatus
): HeatmapStatus => {
  switch (status) {
    case TestCaseStatus.Success:
      return 'success';
    case TestCaseStatus.Failed:
      return 'failed';
    case TestCaseStatus.Aborted:
      return 'aborted';
    case TestCaseStatus.Queued:
    default:
      return 'no-data';
  }
};

/**
 * Transforms dimension results into heatmap data structure
 * Optimized with O(n) pre-indexing to avoid nested loops
 *
 * @param results - Array of dimension test results with timestamps
 * @param startTs - Start timestamp for date range
 * @param endTs - End timestamp for date range
 * @returns Array of heatmap rows, each containing dimension value and cells for each date
 */
export const transformDimensionResultsToHeatmapData = (
  results: DimensionResultWithTimestamp[],
  startTs: number,
  endTs: number
): HeatmapRowData[] => {
  const dateRange = generateDateRange(startTs, endTs);

  // Pre-index results by dimension-date key for O(1) lookup
  // Key format: "dimensionValue|yyyy-MM-dd"
  const resultMap = new Map<string, DimensionResultWithTimestamp>();
  const dimensionValues = new Set<string>();

  results.forEach((result) => {
    const dimensionValue = result.dimensionValues
      .map((dv) => dv.value)
      .join(', ');

    dimensionValues.add(dimensionValue);

    if (result.timestamp) {
      const resultDate = format(new Date(result.timestamp), 'yyyy-MM-dd');
      const key = `${dimensionValue}|${resultDate}`;
      resultMap.set(key, result);
    }
  });

  // Build heatmap data using indexed lookups
  const heatmapData: HeatmapRowData[] = Array.from(dimensionValues).map(
    (dimensionValue) => {
      const cells: HeatmapCellData[] = dateRange.map((date) => {
        const key = `${dimensionValue}|${date}`;
        const resultForDate = resultMap.get(key);

        return {
          date,
          status: resultForDate
            ? mapStatusToHeatmapStatus(resultForDate.testCaseStatus)
            : 'no-data',
          dimensionValue,
          result: resultForDate,
        };
      });

      return {
        dimensionValue,
        cells,
      };
    }
  );

  return heatmapData;
};

export const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);

  return format(date, 'MMM d');
};

export const getStatusLabel = (
  status: HeatmapStatus,
  t: (key: string) => string
): string => {
  const statusMap: Record<HeatmapStatus, string> = {
    success: t('label.success'),
    failed: t('label.failed'),
    aborted: t('label.aborted'),
    'no-data': t('label.no-data'),
  };

  return statusMap[status];
};

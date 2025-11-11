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

export const generateDateRange = (startTs: number, endTs: number): string[] => {
  const dates: string[] = [];
  const startDate = new Date(startTs);
  const endDate = new Date(endTs);

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(format(currentDate, 'yyyy-MM-dd'));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates.reverse();
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

export const transformDimensionResultsToHeatmapData = (
  results: DimensionResultWithTimestamp[],
  startTs: number,
  endTs: number
): HeatmapRowData[] => {
  const dateRange = generateDateRange(startTs, endTs);

  const dimensionValueMap = new Map<string, Set<string>>();

  results.forEach((result) => {
    const dimensionValue = result.dimensionValues
      .map((dv) => dv.value)
      .join(', ');

    if (!dimensionValueMap.has(dimensionValue)) {
      dimensionValueMap.set(dimensionValue, new Set());
    }
  });

  const heatmapData: HeatmapRowData[] = Array.from(
    dimensionValueMap.keys()
  ).map((dimensionValue) => {
    const cells: HeatmapCellData[] = dateRange.map((date) => {
      const resultForDate = results.find((result) => {
        const resultDimensionValue = result.dimensionValues
          .map((dv) => dv.value)
          .join(', ');

        const matchesDimension = resultDimensionValue === dimensionValue;

        if (!matchesDimension || !result.timestamp) {
          return false;
        }

        const resultDate = format(new Date(result.timestamp), 'yyyy-MM-dd');
        const matchesDate = resultDate === date;

        return matchesDimension && matchesDate;
      });

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
  });

  return heatmapData;
};

export const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);

  return format(date, 'MMM d');
};

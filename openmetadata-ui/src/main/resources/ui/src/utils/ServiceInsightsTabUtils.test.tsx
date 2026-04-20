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

import { SystemChartType } from '../enums/DataInsight.enum';
import { DataInsightCustomChartResult } from '../rest/DataInsightAPI';
import {
  filterDistributionChartItem,
  getFormattedTotalAssetsDataFromSocketData,
  getPlatformInsightsChartDataFormattingMethod,
} from './ServiceInsightsTabUtils';

describe('ServiceInsightsTabUtils', () => {
  describe('filterDistributionChartItem', () => {
    it('should return true when term has exactly 2 parts and second part matches group', () => {
      const item = {
        term: 'service.group',
        group: 'group',
      };

      const result = filterDistributionChartItem(item);

      expect(result).toBe(true);
    });

    it('should return false when term has more than 2 parts', () => {
      const item = {
        term: 'service.group.extra',
        group: 'group',
      };

      const result = filterDistributionChartItem(item);

      expect(result).toBe(false);
    });

    it('should return false when term has less than 2 parts', () => {
      const item = {
        term: 'service',
        group: 'group',
      };

      const result = filterDistributionChartItem(item);

      expect(result).toBe(false);
    });

    it('should return false when second part does not match group', () => {
      const item = {
        term: 'service.different',
        group: 'group',
      };

      const result = filterDistributionChartItem(item);

      expect(result).toBe(false);
    });

    it('should handle case-insensitive comparison', () => {
      const item = {
        term: 'service.GROUP',
        group: 'group',
      };

      const result = filterDistributionChartItem(item);

      expect(result).toBe(true);
    });

    it('should handle case-insensitive comparison with . in name', () => {
      const item = {
        term: 'service."Random.group"',
        group: 'random.group',
      };

      const result = filterDistributionChartItem(item);

      expect(result).toBe(true);
    });
  });

  describe('getPlatformInsightsChartDataFormattingMethod', () => {
    const mockChartsData = {
      [SystemChartType.TotalDataAssets]: {
        results: [
          { day: 1, count: 10, group: 'group1', term: 'term1' },
          { day: 2, count: 20, group: 'group2', term: 'term2' },
        ],
      },
    } as unknown as Record<SystemChartType, DataInsightCustomChartResult>;

    it('should return default object when chartsData is null', () => {
      const formatter = getPlatformInsightsChartDataFormattingMethod(
        null as unknown as Record<SystemChartType, DataInsightCustomChartResult>
      );

      const result = formatter(SystemChartType.TotalDataAssets);

      expect(result).toEqual({
        isIncreased: false,
        percentageChange: 0,
        currentPercentage: 0,
        noRecords: true,
        numberOfDays: 0,
      });
    });

    it('should return default object when chartsData is undefined', () => {
      const formatter = getPlatformInsightsChartDataFormattingMethod(
        undefined as unknown as Record<
          SystemChartType,
          DataInsightCustomChartResult
        >
      );

      const result = formatter(SystemChartType.TotalDataAssets);

      expect(result).toEqual({
        isIncreased: false,
        percentageChange: 0,
        currentPercentage: 0,
        noRecords: true,
        numberOfDays: 0,
      });
    });

    it('should return default object when chartType does not exist in chartsData', () => {
      const formatter = getPlatformInsightsChartDataFormattingMethod(
        {} as unknown as Record<SystemChartType, DataInsightCustomChartResult>
      );

      const result = formatter(SystemChartType.TotalDataAssets);

      expect(result).toEqual({
        isIncreased: false,
        percentageChange: 0,
        currentPercentage: 0,
        noRecords: true,
        numberOfDays: 0,
      });
    });

    it('should return default object when results array is empty', () => {
      const emptyResultsData = {
        [SystemChartType.TotalDataAssets]: {
          results: [],
        },
      } as unknown as Record<SystemChartType, DataInsightCustomChartResult>;

      const formatter =
        getPlatformInsightsChartDataFormattingMethod(emptyResultsData);

      const result = formatter(SystemChartType.TotalDataAssets);

      expect(result).toEqual({
        isIncreased: false,
        percentageChange: 0,
        currentPercentage: 0,
        noRecords: true,
        numberOfDays: 0,
      });
    });

    it('should return formatted data when valid chartsData is provided', () => {
      const formatter =
        getPlatformInsightsChartDataFormattingMethod(mockChartsData);

      const result = formatter(SystemChartType.TotalDataAssets);

      expect(result.isIncreased).toBe(true);
      expect(result.percentageChange).toBe(10);
      expect(result.currentPercentage).toBe(20);
      expect(result.numberOfDays).toBe(1);
    });
  });

  describe('getFormattedTotalAssetsDataFromSocketData', () => {
    const mockSocketData: DataInsightCustomChartResult = {
      results: [
        { count: 10, group: 'table', term: 'term1', day: 1 },
        { count: 5, group: 'topic', term: 'term2', day: 1 },
      ],
    };

    it('should return empty array when socketData is null', () => {
      const result = getFormattedTotalAssetsDataFromSocketData(
        null as unknown as DataInsightCustomChartResult,
        'databaseServices'
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when socketData is undefined', () => {
      const result = getFormattedTotalAssetsDataFromSocketData(
        undefined as unknown as DataInsightCustomChartResult,
        'databaseServices'
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when socketData.results is null', () => {
      const socketDataWithNullResults = {
        results: null,
      } as unknown as DataInsightCustomChartResult;

      const result = getFormattedTotalAssetsDataFromSocketData(
        socketDataWithNullResults,
        'databaseServices'
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when socketData.results is undefined', () => {
      const socketDataWithUndefinedResults = {} as DataInsightCustomChartResult;

      const result = getFormattedTotalAssetsDataFromSocketData(
        socketDataWithUndefinedResults,
        'databaseServices'
      );

      expect(result).toEqual([]);
    });

    it('should return formatted array when valid socketData is provided', () => {
      const result = getFormattedTotalAssetsDataFromSocketData(
        mockSocketData,
        'databaseServices'
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

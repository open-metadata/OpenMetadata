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
import {
  generateDateRange,
  getDateLabel,
  getStatusLabel,
  mapStatusToHeatmapStatus,
  transformDimensionResultsToHeatmapData,
} from './DimensionalityHeatmap.utils';

describe('DimensionalityHeatmap.utils', () => {
  describe('generateDateRange', () => {
    it('should generate date range in reverse order', () => {
      const startTs = new Date('2025-01-01').getTime();
      const endTs = new Date('2025-01-03').getTime();

      const result = generateDateRange(startTs, endTs);

      expect(result).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
    });

    it('should handle single day range', () => {
      const startTs = new Date('2025-01-01').getTime();
      const endTs = new Date('2025-01-01').getTime();

      const result = generateDateRange(startTs, endTs);

      expect(result).toEqual(['2025-01-01']);
    });

    it('should handle week-long range', () => {
      const startTs = new Date('2025-01-01').getTime();
      const endTs = new Date('2025-01-07').getTime();

      const result = generateDateRange(startTs, endTs);

      expect(result).toHaveLength(7);
      expect(result[0]).toBe('2025-01-01');
      expect(result[6]).toBe('2025-01-07');
    });

    it('should throw error when start date is after end date', () => {
      const startTs = new Date('2025-01-07').getTime();
      const endTs = new Date('2025-01-01').getTime();

      expect(() => generateDateRange(startTs, endTs)).toThrow(
        'Invalid date range'
      );
    });

    it('should throw error when start timestamp is not finite', () => {
      expect(() => generateDateRange(Infinity, new Date().getTime())).toThrow(
        'Invalid timestamp: timestamps must be finite numbers'
      );
    });

    it('should throw error when end timestamp is not finite', () => {
      expect(() => generateDateRange(new Date().getTime(), NaN)).toThrow(
        'Invalid timestamp: timestamps must be finite numbers'
      );
    });

    it('should throw error when timestamp creates invalid date', () => {
      expect(() => generateDateRange(NaN, NaN)).toThrow('Invalid timestamp');
    });
  });

  describe('mapStatusToHeatmapStatus', () => {
    it('should map Success to success', () => {
      expect(mapStatusToHeatmapStatus(TestCaseStatus.Success)).toBe('success');
    });

    it('should map Failed to failed', () => {
      expect(mapStatusToHeatmapStatus(TestCaseStatus.Failed)).toBe('failed');
    });

    it('should map Aborted to aborted', () => {
      expect(mapStatusToHeatmapStatus(TestCaseStatus.Aborted)).toBe('aborted');
    });

    it('should map Queued to no-data', () => {
      expect(mapStatusToHeatmapStatus(TestCaseStatus.Queued)).toBe('no-data');
    });
  });

  describe('transformDimensionResultsToHeatmapData', () => {
    const createMockResult = (
      dimensionValue: string,
      date: string,
      status: TestCaseStatus
    ): DimensionResultWithTimestamp => ({
      dimensionValues: [{ name: 'region', value: dimensionValue }],
      timestamp: new Date(date).getTime(),
      testCaseStatus: status,
      passedRows: 100,
      failedRows: 0,
      testResultValue: [],
    });

    it('should transform single dimension with single date', () => {
      const results = [
        createMockResult('US', '2025-01-01', TestCaseStatus.Success),
      ];
      const startTs = new Date('2025-01-01').getTime();
      const endTs = new Date('2025-01-01').getTime();

      const heatmapData = transformDimensionResultsToHeatmapData(
        results,
        startTs,
        endTs
      );

      expect(heatmapData).toHaveLength(1);
      expect(heatmapData[0].dimensionValue).toBe('US');
      expect(heatmapData[0].cells).toHaveLength(1);
      expect(heatmapData[0].cells[0].status).toBe('success');
    });

    it('should handle multiple dimensions', () => {
      const results = [
        createMockResult('US', '2025-01-01', TestCaseStatus.Success),
        createMockResult('EU', '2025-01-01', TestCaseStatus.Failed),
      ];
      const startTs = new Date('2025-01-01').getTime();
      const endTs = new Date('2025-01-01').getTime();

      const heatmapData = transformDimensionResultsToHeatmapData(
        results,
        startTs,
        endTs
      );

      expect(heatmapData).toHaveLength(2);
      expect(heatmapData.map((row) => row.dimensionValue)).toContain('US');
      expect(heatmapData.map((row) => row.dimensionValue)).toContain('EU');
    });

    it('should fill missing dates with no-data status', () => {
      const results = [
        createMockResult('US', '2025-01-01', TestCaseStatus.Success),
      ];
      const startTs = new Date('2025-01-01').getTime();
      const endTs = new Date('2025-01-03').getTime();

      const heatmapData = transformDimensionResultsToHeatmapData(
        results,
        startTs,
        endTs
      );

      expect(heatmapData[0].cells).toHaveLength(3);
      expect(heatmapData[0].cells[0].status).toBe('success'); // 2025-01-03
      expect(heatmapData[0].cells[1].status).toBe('no-data'); // 2025-01-02
      expect(heatmapData[0].cells[2].status).toBe('no-data'); // 2025-01-01
    });

    it('should handle results without timestamp', () => {
      const resultsWithoutTimestamp = [
        {
          dimensionValues: [{ name: 'region', value: 'US' }],
          timestamp: undefined,
          testCaseStatus: TestCaseStatus.Success,
          passedRows: 100,
          failedRows: 0,
          testResultValue: [],
        },
      ] as DimensionResultWithTimestamp[];

      const startTs = new Date('2025-01-01').getTime();
      const endTs = new Date('2025-01-01').getTime();

      const heatmapData = transformDimensionResultsToHeatmapData(
        resultsWithoutTimestamp,
        startTs,
        endTs
      );

      expect(heatmapData[0].cells[0].status).toBe('no-data');
    });

    it('should use Map for O(1) lookup performance', () => {
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(
          createMockResult(`Dim${i}`, '2025-01-01', TestCaseStatus.Success)
        );
      }

      const startTs = new Date('2025-01-01').getTime();
      const endTs = new Date('2025-01-30').getTime();

      const start = performance.now();
      transformDimensionResultsToHeatmapData(results, startTs, endTs);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('getDateLabel', () => {
    it('should format date as MMM d', () => {
      expect(getDateLabel('2025-01-15')).toBe('Jan 15');
    });

    it('should handle different months', () => {
      expect(getDateLabel('2025-12-25')).toBe('Dec 25');
    });

    it('should handle single digit days', () => {
      expect(getDateLabel('2025-03-05')).toBe('Mar 5');
    });
  });

  describe('getStatusLabel', () => {
    const mockT = jest.fn((key: string) => {
      const translations: Record<string, string> = {
        'label.success': 'Success',
        'label.failed': 'Failed',
        'label.aborted': 'Aborted',
        'label.no-data': 'No Data',
      };

      return translations[key] || key;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return correct label for success status', () => {
      const result = getStatusLabel('success', mockT);

      expect(result).toBe('Success');
      expect(mockT).toHaveBeenCalledWith('label.success');
    });

    it('should return correct label for failed status', () => {
      const result = getStatusLabel('failed', mockT);

      expect(result).toBe('Failed');
      expect(mockT).toHaveBeenCalledWith('label.failed');
    });

    it('should return correct label for aborted status', () => {
      const result = getStatusLabel('aborted', mockT);

      expect(result).toBe('Aborted');
      expect(mockT).toHaveBeenCalledWith('label.aborted');
    });

    it('should return correct label for no-data status', () => {
      const result = getStatusLabel('no-data', mockT);

      expect(result).toBe('No Data');
      expect(mockT).toHaveBeenCalledWith('label.no-data');
    });
  });
});

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

import { filterDistributionChartItem } from './ServiceInsightsTabUtils';

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
});

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
import { percentageFormatter } from './ChartUtils';

describe('ChartUtils', () => {
  describe('percentageFormatter', () => {
    it('should format number with percentage symbol', () => {
      expect(percentageFormatter(50)).toBe('50%');
      expect(percentageFormatter(100)).toBe('100%');
    });

    it('should handle decimal numbers', () => {
      expect(percentageFormatter(50.5)).toBe('50.5%');
      expect(percentageFormatter(33.33)).toBe('33.33%');
    });

    it('should return empty string for undefined value', () => {
      expect(percentageFormatter(undefined)).toBe('');
    });
  });
});

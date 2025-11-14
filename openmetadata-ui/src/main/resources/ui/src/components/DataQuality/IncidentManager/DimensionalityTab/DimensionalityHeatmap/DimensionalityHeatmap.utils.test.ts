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

import { getStatusLabel } from './DimensionalityHeatmap.utils';

describe('DimensionalityHeatmap.utils', () => {
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

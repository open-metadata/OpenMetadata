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
import { chipLabel, chipTriggerClassName } from './dqFilterChip.utils';

describe('dqFilterChip utils', () => {
  describe('chipLabel', () => {
    it('should return the bare label when the count is zero', () => {
      expect(chipLabel('Tags', 0)).toBe('Tags');
    });

    it('should append the count when it is greater than zero', () => {
      expect(chipLabel('Tags', 3)).toBe('Tags · 3');
    });

    it('should not append a negative count', () => {
      expect(chipLabel('Owner', -1)).toBe('Owner');
    });
  });

  describe('chipTriggerClassName', () => {
    it('should be a non-empty class string matching the secondary chip look', () => {
      expect(typeof chipTriggerClassName).toBe('string');
      expect(chipTriggerClassName).toContain('tw:inline-flex');
      expect(chipTriggerClassName).toContain('tw:text-secondary');
    });
  });
});

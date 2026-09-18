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
import {
  chipCountBadgeClassName,
  chipTriggerClassName,
  chipTriggerSelectedClassName,
} from './dqFilterChip.utils';

describe('dqFilterChip utils', () => {
  describe('chipTriggerClassName', () => {
    it('should carry the borderless quick-filter treatment', () => {
      expect(chipTriggerClassName).toContain('tw:text-tertiary');
      expect(chipTriggerClassName).toContain('tw:p-1');
    });

    it('should not carry the bordered chip treatment', () => {
      // The owner trigger sits beside FilterSelect chips rendered as borderless
      // buttons; a border or skeuomorphic shadow here is the visual drift this
      // guards against.
      expect(chipTriggerClassName).not.toContain('shadow-xs-skeuomorphic');
      expect(chipTriggerClassName).not.toContain('after:outline-primary');
    });
  });

  describe('chipTriggerSelectedClassName', () => {
    it('should brand the trigger the way FilterSelect does', () => {
      expect(chipTriggerSelectedClassName).toContain(
        'tw:text-fg-brand-primary'
      );
    });
  });

  describe('chipCountBadgeClassName', () => {
    it('should be a round brand badge with equal height and min width', () => {
      expect(chipCountBadgeClassName).toContain('tw:rounded-full');
      expect(chipCountBadgeClassName).toContain('tw:h-[18px]');
      expect(chipCountBadgeClassName).toContain('tw:min-w-[18px]');
      expect(chipCountBadgeClassName).toContain('tw:bg-utility-brand-50');
    });
  });
});

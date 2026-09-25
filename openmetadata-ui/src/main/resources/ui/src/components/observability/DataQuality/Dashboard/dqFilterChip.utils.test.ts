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
  chipChevronClassName,
  chipCountBadgeClassName,
  chipTriggerClassName,
  chipTriggerSelectedClassName,
} from './dqFilterChip.utils';

describe('dqFilterChip utils', () => {
  describe('chipTriggerClassName', () => {
    it('should carry the bordered pill treatment', () => {
      // The owner trigger sits beside FilterSelect chips rendered with
      // `bordered`; a borderless trigger here is the visual drift this guards
      // against.
      expect(chipTriggerClassName).toContain('tw:shadow-xs-skeuomorphic');
      expect(chipTriggerClassName).toContain('tw:after:outline-primary');
      expect(chipTriggerClassName).toContain('tw:bg-surface');
      expect(chipTriggerClassName).toContain('tw:px-3.5');
    });

    it('should not carry the borderless quick-filter treatment', () => {
      expect(chipTriggerClassName).not.toContain('tw:text-tertiary');
      expect(chipTriggerClassName).not.toContain('tw:p-1 ');
    });
  });

  describe('chipTriggerSelectedClassName', () => {
    it('should brand the trigger the way FilterSelect does', () => {
      expect(chipTriggerSelectedClassName).toContain(
        'tw:text-fg-brand-primary'
      );
      expect(chipTriggerSelectedClassName).toContain('tw:after:outline-brand');
    });
  });

  describe('chipChevronClassName', () => {
    it('should brand the chevron once a value is picked, like FilterSelect does', () => {
      // A chevron left grey beside a branded label is the drift this guards
      // against; the two colours are one Tailwind group, so it is either/or.
      expect(chipChevronClassName(true)).toContain('tw:text-fg-brand-primary');
      expect(chipChevronClassName(true)).not.toContain('tw:text-fg-quaternary');
      expect(chipChevronClassName(false)).toContain('tw:text-fg-quaternary');
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

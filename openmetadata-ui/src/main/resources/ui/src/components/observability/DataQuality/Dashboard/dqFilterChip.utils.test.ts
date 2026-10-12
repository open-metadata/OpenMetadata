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
} from './dqFilterChip.utils';

describe('dqFilterChip utils', () => {
  describe('chipTriggerClassName', () => {
    it('should carry the bordered pill treatment', () => {
      // The owner trigger sits beside FilterSelect chips rendered with
      // `bordered`; a borderless trigger here is the visual drift this guards
      // against.
      const className = chipTriggerClassName(false);

      expect(className).toContain('tw:shadow-xs-skeuomorphic');
      expect(className).toContain('tw:after:outline-primary');
      expect(className).toContain('tw:bg-surface');
      expect(className).toContain('tw:px-3.5');
    });

    it('should not carry the borderless quick-filter treatment', () => {
      expect(chipTriggerClassName(false)).not.toContain('tw:text-tertiary');
      expect(chipTriggerClassName(false)).not.toContain('tw:p-1 ');
    });

    it('should swap the neutral label and outline for brand once a value is picked', () => {
      const selected = chipTriggerClassName(true);

      expect(selected).toContain('tw:text-fg-brand-primary');
      expect(selected).toContain('tw:after:outline-brand');
      expect(selected).toContain('tw:dark:after:outline-fg-brand-primary_alt');
      expect(selected).not.toContain('tw:text-secondary');
      expect(selected).not.toContain('tw:after:outline-primary');
      expect(chipTriggerClassName(false)).not.toContain('brand-primary');
    });
  });

  describe('chipChevronClassName', () => {
    it('should brand the chevron once a value is picked, like FilterSelect does', () => {
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

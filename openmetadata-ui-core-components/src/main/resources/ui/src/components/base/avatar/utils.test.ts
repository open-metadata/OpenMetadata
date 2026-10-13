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
import { describe, expect, it } from 'vitest';
import { getAvatarColorClasses } from './utils';

const NAMES = ['admin', 'Harsha', 'Mayur', 'Karan', 'Reethika', 'x', 'Team A'];

describe('getAvatarColorClasses', () => {
  it('keeps the outlined hue border out of light mode', () => {
    for (const name of NAMES) {
      const classes = getAvatarColorClasses(name, 'outlined').container.split(
        ' '
      );

      expect(classes).not.toContain('tw:border');
      expect(classes.some((c) => c.startsWith('tw:border-utility-'))).toBe(
        false
      );
      expect(classes).toContain('tw:dark:border');
      expect(classes.some((c) => c.startsWith('tw:dark:border-utility-'))).toBe(
        true
      );
    }
  });

  it('maps the same name to the same colour', () => {
    expect(getAvatarColorClasses('Harsha')).toEqual(
      getAvatarColorClasses('Harsha')
    );
  });
});

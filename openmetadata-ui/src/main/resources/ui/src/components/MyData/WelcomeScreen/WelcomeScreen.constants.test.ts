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
  getWelcomeAccentStyle,
  isThemeDefaultPrimary,
} from './WelcomeScreen.constants';

describe('getWelcomeAccentStyle', () => {
  it('should keep the theme colour when no accent is given', () => {
    expect(getWelcomeAccentStyle()).toBeUndefined();
  });

  it('should point the glow and button variables at the accent family', () => {
    expect(getWelcomeAccentStyle('purple')).toEqual({
      '--tw-color-brand-500': 'var(--tw-color-purple-500)',
      '--tw-background-color-brand-solid': 'var(--tw-color-purple-600)',
      '--tw-background-color-brand-solid_hover': 'var(--tw-color-purple-700)',
    });
  });
});

describe('isThemeDefaultPrimary', () => {
  it.each([
    [undefined, true],
    ['', true],
    ['#1570EF', true],
    ['#E11D48', false],
  ])('should treat %s as default: %s', (color, expected) => {
    expect(isThemeDefaultPrimary(color)).toBe(expected);
  });
});

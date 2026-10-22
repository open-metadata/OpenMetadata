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
  getWelcomeThemeStyle,
  WELCOME_GLOW_DARK,
  WELCOME_GLOW_LIGHT,
} from './WelcomeScreen.constants';

describe('getWelcomeThemeStyle', () => {
  it('should leave the theme colours without a welcome theme', () => {
    expect(getWelcomeThemeStyle()).toBeUndefined();
  });

  it('should pin the glow and button to the welcome theme', () => {
    expect(
      getWelcomeThemeStyle({
        glow: 'blue-500',
        button: 'blue-700',
        buttonHover: 'blue-800',
      })
    ).toEqual({
      '--tw-color-brand-500': 'var(--tw-color-blue-500)',
      '--tw-background-color-brand-solid': 'var(--tw-color-blue-700)',
      '--tw-background-color-brand-solid_hover': 'var(--tw-color-blue-800)',
    });
  });
});

describe('welcome glow', () => {
  // The glow must read brand-500, which getWelcomeThemeStyle pins.
  it.each([WELCOME_GLOW_LIGHT, WELCOME_GLOW_DARK])(
    'should be drawn from brand-500',
    (glow) => {
      expect(glow).toContain('var(--tw-color-brand-500)');
    }
  );
});

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
  getWelcomeGlow,
  getWelcomeThemeStyle,
} from './WelcomeScreen.constants';

describe('getWelcomeThemeStyle', () => {
  it('should leave the theme colours without a welcome theme', () => {
    expect(getWelcomeThemeStyle()).toBeUndefined();
  });

  it('should pin the button to the welcome theme', () => {
    expect(
      getWelcomeThemeStyle({
        glow: 'blue-500',
        button: 'blue-700',
        buttonHover: 'blue-800',
      })
    ).toEqual({
      '--tw-background-color-brand-solid': 'var(--tw-color-blue-700)',
      '--tw-background-color-brand-solid_hover': 'var(--tw-color-blue-800)',
    });
  });
});

describe('getWelcomeGlow', () => {
  it('should draw the light glow in the given colour token', () => {
    const glow = getWelcomeGlow('purple-500', false);

    expect(glow).toMatch(/^radial-gradient\(168\.55% 167\.82% /);
    expect(glow).toContain(
      'color-mix(in srgb, var(--tw-color-purple-500) 25%, transparent) 77.5%'
    );
    expect(glow).not.toContain('brand');
  });

  it('should use the wider, fainter dark glow', () => {
    const glow = getWelcomeGlow('blue-500', true);

    expect(glow).toMatch(/^radial-gradient\(220\.28% 218\.41% /);
    expect(glow).toContain(
      'color-mix(in srgb, var(--tw-color-blue-500) 30%, transparent) 73%'
    );
  });
});

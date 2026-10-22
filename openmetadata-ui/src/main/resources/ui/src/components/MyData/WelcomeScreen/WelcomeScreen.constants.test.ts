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
  isThemeDefaultPrimary,
  WELCOME_GLOW_DARK,
  WELCOME_GLOW_LIGHT,
} from './WelcomeScreen.constants';

describe('getWelcomeThemeStyle', () => {
  it('should keep the theme colour with no accent and a default primary', () => {
    expect(getWelcomeThemeStyle({ hasCustomPrimary: false })).toBeUndefined();
  });

  it('should point the glow, button and dark strength at the accent family', () => {
    expect(
      getWelcomeThemeStyle({ accent: 'purple', hasCustomPrimary: false })
    ).toEqual({
      '--tw-color-brand-500': 'var(--tw-color-purple-500)',
      '--tw-background-color-brand-solid': 'var(--tw-color-purple-600)',
      '--tw-background-color-brand-solid_hover': 'var(--tw-color-purple-700)',
      '--welcome-glow-dark-mix': '100%',
    });
  });

  // A custom theme overrides brand-600, not brand-500, so the glow is
  // re-pointed at it.
  it('should send a configured primary colour to the glow', () => {
    expect(getWelcomeThemeStyle({ hasCustomPrimary: true })).toEqual({
      '--tw-color-brand-500': 'var(--tw-color-brand-600)',
    });
  });
});

describe('welcome glow', () => {
  it("should sample Figma's t² curve on the approved light ellipse", () => {
    expect(WELCOME_GLOW_LIGHT).toMatch(
      /^radial-gradient\(168\.55% 167\.82% at 55\.79% -31\.38%, /
    );
    expect(WELCOME_GLOW_LIGHT).toContain(
      'color-mix(in srgb, var(--tw-color-brand-500) 0%, transparent) 55%'
    );
    expect(WELCOME_GLOW_LIGHT).toContain(
      'color-mix(in srgb, var(--tw-color-brand-500) 25%, transparent) 77.5%'
    );
    expect(WELCOME_GLOW_LIGHT).toContain(
      'color-mix(in srgb, var(--tw-color-brand-500) 100%, transparent) 100%'
    );
  });

  it('should use the wider dark ellipse, ending at the dark-mix strength', () => {
    expect(WELCOME_GLOW_DARK).toMatch(
      /^radial-gradient\(220\.28% 218\.41% at 55\.79% -31\.38%, /
    );
    expect(WELCOME_GLOW_DARK).toContain(
      'calc(100% - (100% - var(--welcome-glow-dark-mix, 20%)) * 1), transparent) 100%'
    );
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

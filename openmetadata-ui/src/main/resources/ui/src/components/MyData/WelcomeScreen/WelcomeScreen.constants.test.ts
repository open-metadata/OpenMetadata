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

  it('should pin the glow, button and dark strength to the welcome theme', () => {
    expect(
      getWelcomeThemeStyle({
        glow: 'blue-500',
        button: 'blue-700',
        buttonHover: 'blue-800',
        darkGlowMix: '20%',
      })
    ).toEqual({
      '--tw-color-brand-500': 'var(--tw-color-blue-500)',
      '--tw-background-color-brand-solid': 'var(--tw-color-blue-700)',
      '--tw-background-color-brand-solid_hover': 'var(--tw-color-blue-800)',
      '--welcome-glow-dark-mix': '20%',
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

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

import { CSSProperties } from 'react';
import { WelcomeTheme } from '../../../utils/BrandData/BrandClassBase';

/**
 * Glow from the approved Figma frame (Rectangle 8) in the given core colour
 * token. Figma renders a transparent-to-colour stop at t² rather than CSS's t,
 * so the extra stops keep it as soft as the mock; dark mode uses a wider
 * ellipse peaking at 30% of the colour.
 */
export const getWelcomeGlow = (colorToken: string, isDark: boolean) => {
  const color = `var(--tw-color-${colorToken})`;
  const stops = isDark
    ? [
        '220.28% 218.41% at 55.79% -31.38%',
        'transparent 47%',
        `color-mix(in srgb, ${color} 20%, transparent) 60%`,
        `color-mix(in srgb, ${color} 30%, transparent) 73%`,
        `color-mix(in srgb, ${color} 30%, transparent) 87%`,
        `color-mix(in srgb, ${color} 20%, transparent)`,
      ]
    : [
        '168.55% 167.82% at 55.79% -31.38%',
        'transparent 55%',
        `color-mix(in srgb, ${color} 6%, transparent) 66%`,
        `color-mix(in srgb, ${color} 25%, transparent) 77.5%`,
        `color-mix(in srgb, ${color} 56%, transparent) 89%`,
        color,
      ];

  return `radial-gradient(${stops.join(', ')})`;
};

/**
 * Pins the primary button's `bg-brand-solid` to the product's fixed welcome
 * colours, so a custom theme does not change it. `undefined` (a downstream
 * brand class without getWelcomeTheme) leaves the theme colours.
 */
export const getWelcomeThemeStyle = (
  welcomeTheme?: WelcomeTheme
): CSSProperties | undefined =>
  welcomeTheme
    ? ({
        '--tw-background-color-brand-solid': `var(--tw-color-${welcomeTheme.button})`,
        '--tw-background-color-brand-solid_hover': `var(--tw-color-${welcomeTheme.buttonHover})`,
      } as CSSProperties)
    : undefined;

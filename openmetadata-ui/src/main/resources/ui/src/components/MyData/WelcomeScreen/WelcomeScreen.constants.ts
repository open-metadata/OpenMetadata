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

// Glow from the approved Figma frame (Rectangle 8), drawn in brand-500, which
// getWelcomeThemeStyle pins. Figma renders a transparent-to-colour stop at t²
// rather than CSS's t, so the extra stops keep it as soft as the mock.
export const WELCOME_GLOW_LIGHT = `radial-gradient(${[
  '168.55% 167.82% at 55.79% -31.38%',
  'transparent 55%',
  'color-mix(in srgb, var(--tw-color-brand-500) 6%, transparent) 66%',
  'color-mix(in srgb, var(--tw-color-brand-500) 25%, transparent) 77.5%',
  'color-mix(in srgb, var(--tw-color-brand-500) 56%, transparent) 89%',
  'var(--tw-color-brand-500)',
].join(', ')})`;

// Dark: a wider ellipse peaking at 30% of the colour.
export const WELCOME_GLOW_DARK = `radial-gradient(${[
  '220.28% 218.41% at 55.79% -31.38%',
  'transparent 47%',
  'color-mix(in srgb, var(--tw-color-brand-500) 20%, transparent) 60%',
  'color-mix(in srgb, var(--tw-color-brand-500) 30%, transparent) 73%',
  'color-mix(in srgb, var(--tw-color-brand-500) 30%, transparent) 87%',
  'color-mix(in srgb, var(--tw-color-brand-500) 20%, transparent)',
].join(', ')})`;

/**
 * Pins the brand variables the welcome screen reads (the glow above and the
 * primary button's `bg-brand-solid`) to the product's fixed welcome colours,
 * so a custom theme does not change them. `undefined` (a downstream brand
 * class without getWelcomeTheme) leaves the theme colours.
 */
export const getWelcomeThemeStyle = (
  welcomeTheme?: WelcomeTheme
): CSSProperties | undefined =>
  welcomeTheme
    ? ({
        '--tw-color-brand-500': `var(--tw-color-${welcomeTheme.glow})`,
        '--tw-background-color-brand-solid': `var(--tw-color-${welcomeTheme.button})`,
        '--tw-background-color-brand-solid_hover': `var(--tw-color-${welcomeTheme.buttonHover})`,
      } as CSSProperties)
    : undefined;

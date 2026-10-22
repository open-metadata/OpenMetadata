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

// Glow from the approved Figma frame (Rectangle 8). Figma renders a
// transparent-to-colour stop at t² rather than CSS's t, so the extra stops
// keep it as soft as the mock; a plain two-stop CSS gradient is twice as strong.
const GLOW = 'var(--tw-color-brand-500)';
const mix = (percent: number) =>
  `color-mix(in srgb, ${GLOW} ${percent}%, transparent)`;

export const WELCOME_GLOW_LIGHT = `radial-gradient(168.55% 167.82% at 55.79% -31.38%, transparent 55%, ${mix(
  6
)} 66%, ${mix(25)} 77.5%, ${mix(56)} 89%, ${GLOW})`;

// Dark: a wider ellipse peaking at 30% of the colour.
export const WELCOME_GLOW_DARK = `radial-gradient(220.28% 218.41% at 55.79% -31.38%, transparent 47%, ${mix(
  20
)} 60%, ${mix(30)} 73%, ${mix(30)} 87%, ${mix(20)})`;

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

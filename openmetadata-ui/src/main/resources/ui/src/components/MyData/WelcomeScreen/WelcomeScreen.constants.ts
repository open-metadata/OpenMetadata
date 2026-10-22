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

// Figma "Harsha approved version (option - 2)", Rectangle 8: a radial glow
// rising into the glow colour along the bottom 65% of the panel. `--tw-*` is
// the runtime name of the core theme variables.
//
// Figma blends gradient stops without premultiplying alpha, so a stop running
// from transparent to a colour shows that colour at t² of the way, where CSS
// shows it at t. The stops below sample Figma's curve at quarters of the
// range; they match its PNG export of the approved frames within a few RGB
// steps (a single CSS stop pair renders about twice as strong).
const GLOW_CENTER = 'at 55.79% -31.38%';
// brand-500 is Figma's fg-brand-secondary-500; getWelcomeThemeStyle pins it to
// the product's glow shade.
const GLOW = 'var(--tw-color-brand-500)';
// Dark-mode end strength of the glow colour, set per product.
const DARK_GLOW_MIX = 'var(--welcome-glow-dark-mix, 20%)';
const QUARTERS = [0, 0.25, 0.5, 0.75, 1];

const glowStops = (from: number, mixAt: (t: number) => string): string =>
  QUARTERS.map(
    (t) =>
      `color-mix(in srgb, ${GLOW} ${mixAt(t)}, transparent) ${
        from + (100 - from) * t
      }%`
  ).join(', ');

// Light: transparent 55% to the glow colour at 100%, seen at t².
export const WELCOME_GLOW_LIGHT = `radial-gradient(168.55% 167.82% ${GLOW_CENTER}, ${glowStops(
  55,
  (t) => `${t * t * 100}%`
)})`;

// Dark: the panel colour at 46.85% to the glow colour at m (DARK_GLOW_MIX) on a
// wider ellipse, seen at t * (1 - (1 - m) * t).
export const WELCOME_GLOW_DARK = `radial-gradient(220.28% 218.41% ${GLOW_CENTER}, ${glowStops(
  46.85,
  (t) => `calc(${t * 100}% - (100% - ${DARK_GLOW_MIX}) * ${t * t})`
)})`;

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
        '--welcome-glow-dark-mix': welcomeTheme.darkGlowMix,
      } as CSSProperties)
    : undefined;

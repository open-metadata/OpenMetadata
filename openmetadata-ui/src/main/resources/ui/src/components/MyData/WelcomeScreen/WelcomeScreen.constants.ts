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

// Figma 15448:9083: a radial glow rising into the brand colour along the bottom
// 65% of the panel; dark mode keeps it faint. `--tw-*` is the runtime name of
// the core theme variables, and it follows the configured brand colour.
const GLOW_SHAPE = 'ellipse 168% 168% at 56% -31%';
const BRAND = 'var(--tw-color-brand-500)';

const brandMix = (percent: number) =>
  `color-mix(in srgb, ${BRAND} ${percent}%, transparent)`;

export const WELCOME_GLOW_LIGHT = `radial-gradient(${GLOW_SHAPE}, ${[
  'transparent 55%',
  `${brandMix(50)} 77.5%`,
  `${brandMix(75)} 88.75%`,
  BRAND,
].join(', ')})`;

export const WELCOME_GLOW_DARK = `radial-gradient(${GLOW_SHAPE}, ${[
  'transparent 47%',
  `${brandMix(8)} 60%`,
  `${brandMix(20)} 73%`,
  brandMix(20),
].join(', ')})`;

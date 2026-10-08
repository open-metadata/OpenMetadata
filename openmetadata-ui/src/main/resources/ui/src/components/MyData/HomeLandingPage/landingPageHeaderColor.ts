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
import type { CSSProperties } from 'react';
import type { PersonaPreferences } from '../../../generated/type/personaPreferences';

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// The header keeps its default card's dark text, so a chosen colour is laid on
// as a wash rather than a fill: at these alphas even the darkest swatch the
// Header Theme picker offers stays light enough over the card's own surface
// for the title to keep its contrast, in light and dark mode alike. The angle
// and stop positions follow the default gradient so a tinted header reads as
// the same card in another colour.
const TINT_START_ALPHA = 0.08;
const TINT_END_ALPHA = 0.2;

const findHeaderColor = (
  preferences: PersonaPreferences[] | undefined,
  personaId: string | undefined
): string | undefined =>
  preferences?.find((preference) => preference.personaId === personaId)
    ?.landingPageSettings?.headerColor;

/**
 * The header colour saved for a persona: the user's own choice first, then the
 * one the persona's admin set in the customize page.
 */
export const resolveLandingPageHeaderColor = (
  personaId: string | undefined,
  userPreferences: PersonaPreferences[] | undefined,
  personaPreferences: PersonaPreferences[] | undefined
): string | undefined =>
  personaId
    ? findHeaderColor(userPreferences, personaId) ??
      findHeaderColor(personaPreferences, personaId)
    : undefined;

const toRgba = (hex: string, alpha: number): string => {
  const digits = hex.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  const [r, g, b] = [0, 2, 4].map((at) =>
    Number.parseInt(full.slice(at, at + 2), 16)
  );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Inline background for a header tinted with a saved colour, or `undefined`
 * to keep the default gradient.
 *
 * Only a plain hex colour is honoured. The picker only offers those; anything
 * else is the legacy default — a full `linear-gradient(...)` written for the
 * old saturated header — and means "not customised".
 */
export const getLandingPageHeaderTintStyle = (
  color: string | undefined
): CSSProperties | undefined =>
  color && HEX_COLOR.test(color)
    ? {
        backgroundImage: `linear-gradient(89deg, ${toRgba(
          color,
          TINT_START_ALPHA
        )} -2.31%, ${toRgba(color, TINT_END_ALPHA)} 102.64%)`,
      }
    : undefined;

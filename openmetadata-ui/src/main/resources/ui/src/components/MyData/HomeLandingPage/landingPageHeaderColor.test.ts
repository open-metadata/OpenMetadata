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
import { DEFAULT_HEADER_BG_COLOR } from '../../../constants/Mydata.constants';
import type { PersonaPreferences } from '../../../generated/type/personaPreferences';
import {
  getLandingPageHeaderTintStyle,
  resolveLandingPageHeaderColor,
} from './landingPageHeaderColor';

const preference = (
  personaId: string,
  headerColor?: string
): PersonaPreferences => ({
  personaId,
  personaName: personaId,
  landingPageSettings: { headerColor },
});

describe('resolveLandingPageHeaderColor', () => {
  it("prefers the user's own colour for the persona", () => {
    expect(
      resolveLandingPageHeaderColor(
        'p1',
        [preference('p1', '#111111')],
        [preference('p1', '#222222')]
      )
    ).toBe('#111111');
  });

  it("falls back to the persona's colour when the user set none", () => {
    expect(
      resolveLandingPageHeaderColor(
        'p1',
        [preference('p2', '#111111')],
        [preference('p1', '#222222')]
      )
    ).toBe('#222222');
  });

  it('resolves nothing without a persona', () => {
    expect(
      resolveLandingPageHeaderColor(
        undefined,
        [preference('p1', '#111111')],
        undefined
      )
    ).toBeUndefined();
  });
});

describe('getLandingPageHeaderTintStyle', () => {
  it('washes a six-digit hex colour across the header', () => {
    expect(getLandingPageHeaderTintStyle('#099250')).toEqual({
      backgroundImage:
        'linear-gradient(89deg, rgba(9, 146, 80, 0.08) -2.31%, rgba(9, 146, 80, 0.2) 102.64%)',
    });
  });

  it('expands a three-digit hex colour', () => {
    expect(getLandingPageHeaderTintStyle('#f0a')?.backgroundImage).toContain(
      'rgba(255, 0, 170, 0.2)'
    );
  });

  // The legacy default is a full gradient written for the old saturated
  // header; it means "not customised", not a colour to tint with.
  it('keeps the default header for anything but a hex colour', () => {
    expect(getLandingPageHeaderTintStyle(undefined)).toBeUndefined();
    expect(getLandingPageHeaderTintStyle('')).toBeUndefined();
    expect(
      getLandingPageHeaderTintStyle(DEFAULT_HEADER_BG_COLOR)
    ).toBeUndefined();
  });
});

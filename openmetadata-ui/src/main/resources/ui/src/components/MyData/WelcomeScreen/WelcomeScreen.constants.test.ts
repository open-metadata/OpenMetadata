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
import { getWelcomeAccentStyle } from './WelcomeScreen.constants';

describe('getWelcomeAccentStyle', () => {
  it('should keep the theme colour when no accent is given', () => {
    expect(getWelcomeAccentStyle()).toBeUndefined();
  });

  it('should point the glow and button variables at the accent', () => {
    expect(getWelcomeAccentStyle('#7147E8')).toEqual({
      '--tw-color-brand-500': '#7147E8',
      '--tw-background-color-brand-solid': '#7147E8',
      '--tw-background-color-brand-solid_hover':
        'color-mix(in srgb, #7147E8 85%, black)',
    });
  });
});

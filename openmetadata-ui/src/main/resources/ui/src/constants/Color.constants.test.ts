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

import * as colors from './Color.constants';

const collectColorValues = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.values(value).flatMap(collectColorValues);
};

describe('Color constants', () => {
  it('uses CSS tokens for presentation colors', () => {
    const { CANVAS_BUTTON_COLORS: _canvasFallbacks, ...presentationColors } =
      colors;

    expect(collectColorValues(presentationColors)).not.toHaveLength(0);
    expect(
      collectColorValues(presentationColors).every((color) =>
        color.startsWith('var(--om-')
      )
    ).toBe(true);
  });

  it('keeps concrete canvas colors as resolver fallbacks', () => {
    expect(
      collectColorValues(colors.CANVAS_BUTTON_COLORS).every(
        (color) => !color.startsWith('var(')
      )
    ).toBe(true);
  });
});

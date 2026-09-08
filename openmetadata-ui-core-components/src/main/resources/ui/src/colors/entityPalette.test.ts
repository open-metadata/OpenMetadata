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
  ENTITY_PALETTE,
  ENTITY_PALETTE_HEX,
  getEntityPalettePresentationColor,
} from './entityPalette';
import { describe, expect, it } from 'vitest';

describe('entityPalette', () => {
  it('keeps persisted values concrete while exposing token-backed colors', () => {
    expect(ENTITY_PALETTE_HEX).toEqual(
      ENTITY_PALETTE.map(({ value }) => value)
    );
    expect(ENTITY_PALETTE_HEX.every((color) => color.startsWith('#'))).toBe(
      true
    );
    expect(
      ENTITY_PALETTE.every(({ presentation }) =>
        presentation.startsWith('var(--color-entity-palette-')
      )
    ).toBe(true);
  });

  it('uses tokens for palette colors without rewriting custom colors', () => {
    expect(getEntityPalettePresentationColor('#1470ef')).toBe(
      'var(--color-entity-palette-blue)'
    );
    expect(getEntityPalettePresentationColor('#ABCDEF')).toBe('#ABCDEF');
  });
});

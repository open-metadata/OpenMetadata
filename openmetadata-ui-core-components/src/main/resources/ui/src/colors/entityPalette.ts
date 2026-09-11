/*
 *  Copyright 2025 Collate.
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

export interface EntityPaletteColor {
  presentation: string;
  value: string;
}

// Entity colors are stored by value in metadata. Keeping the concrete value
// separate from its tokenized presentation prevents a theme change from
// rewriting persisted data.
export const ENTITY_PALETTE = [
  { value: '#1470EF', presentation: 'var(--color-entity-palette-blue)' },
  { value: '#7D81E9', presentation: 'var(--color-entity-palette-indigo)' },
  { value: '#F14C75', presentation: 'var(--color-entity-palette-rose)' },
  { value: '#F689A6', presentation: 'var(--color-entity-palette-pink)' },
  { value: '#05C4EA', presentation: 'var(--color-entity-palette-cyan)' },
  { value: '#05A580', presentation: 'var(--color-entity-palette-teal)' },
  { value: '#FFB01A', presentation: 'var(--color-entity-palette-amber)' },
  { value: '#BF4CF1', presentation: 'var(--color-entity-palette-purple)' },
  {
    value: '#99AADF',
    presentation: 'var(--color-entity-palette-blue-muted)',
  },
  {
    value: '#C0B3F2',
    presentation: 'var(--color-entity-palette-indigo-muted)',
  },
  {
    value: '#EDB3B3',
    presentation: 'var(--color-entity-palette-rose-muted)',
  },
  {
    value: '#ECB892',
    presentation: 'var(--color-entity-palette-orange-muted)',
  },
  {
    value: '#90DAE3',
    presentation: 'var(--color-entity-palette-cyan-muted)',
  },
  {
    value: '#82E6C4',
    presentation: 'var(--color-entity-palette-teal-muted)',
  },
] as const satisfies readonly EntityPaletteColor[];

export const ENTITY_PALETTE_HEX: string[] = ENTITY_PALETTE.map(
  ({ value }) => value
);

export const getEntityPalettePresentationColor = (color: string): string =>
  ENTITY_PALETTE.find(
    ({ value }) => value.toLowerCase() === color.toLowerCase()
  )?.presentation ?? color;

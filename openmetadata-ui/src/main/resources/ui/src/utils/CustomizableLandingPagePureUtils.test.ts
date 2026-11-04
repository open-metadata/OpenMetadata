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
import type { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { reflowLayoutToGrid } from './CustomizableLandingPagePureUtils';

const widget = (i: string, x: number, y: number, w = 1, h = 3): WidgetConfig =>
  ({ i, x, y, w, h } as WidgetConfig);

describe('reflowLayoutToGrid', () => {
  it('leaves a layout that already fits untouched', () => {
    const layout = [widget('a', 0, 0), widget('b', 1, 0), widget('c', 0, 3)];

    // Same reference: a persona whose layout still fits keeps exactly what it
    // saved, so no spurious re-render or re-save is triggered.
    expect(reflowLayoutToGrid(layout, 2)).toBe(layout);
  });

  it('re-packs a 3-column layout into 2 columns without leaving holes', () => {
    const layout = [
      widget('a', 0, 0),
      widget('b', 1, 0),
      widget('c', 2, 0), // outside a 2-column grid
      widget('d', 0, 1),
    ];

    expect(
      reflowLayoutToGrid(layout, 2).map(({ i, x, y }) => ({ i, x, y }))
    ).toEqual([
      { i: 'a', x: 0, y: 0 },
      { i: 'b', x: 1, y: 0 },
      { i: 'c', x: 0, y: 3 },
      { i: 'd', x: 1, y: 3 },
    ]);
  });

  it('preserves reading order when the saved layout is unsorted', () => {
    const layout = [widget('d', 0, 1), widget('c', 2, 0), widget('a', 0, 0)];

    expect(reflowLayoutToGrid(layout, 2).map(({ i }) => i)).toEqual([
      'a',
      'c',
      'd',
    ]);
  });

  it('clamps a widget wider than the grid rather than overflowing it', () => {
    const layout = [widget('wide', 0, 0, 3), widget('next', 0, 1)];
    const [wide, next] = reflowLayoutToGrid(layout, 2);

    expect(wide.w).toBe(2);
    expect(next).toMatchObject({ x: 0, y: 3 });
  });
});

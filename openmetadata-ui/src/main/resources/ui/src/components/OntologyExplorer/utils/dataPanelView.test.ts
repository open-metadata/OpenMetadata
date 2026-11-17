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
import { panXClearOfPanel } from './dataPanelView';

const base = {
  containerWidth: 980,
  extentLeft: 400,
  extentRight: 682,
  panelWidth: 334,
  zoom: 1,
};

describe('panXClearOfPanel', () => {
  it('leaves the canvas alone when the lane already ends left of the panel', () => {
    // lane ends at -100 + 682 = 582, inside the 630 limit
    expect(panXClearOfPanel({ ...base, x: -100 })).toBe(-100);
  });

  it('pans left by exactly the overflow, keeping a 16 px gap to the panel', () => {
    // right limit 980 - 334 - 16 = 630; lane ends at 100 + 682 = 782
    expect(panXClearOfPanel({ ...base, x: 100 })).toBe(-52);
  });

  it('scales the lane edge by the zoom', () => {
    // lane ends at 0 + 682 * 0.5 = 341, inside the 630 limit
    expect(panXClearOfPanel({ ...base, x: 0, zoom: 0.5 })).toBe(0);
    // lane ends at 300 + 341 = 641, 11 past the limit
    expect(panXClearOfPanel({ ...base, x: 300, zoom: 0.5 })).toBe(289);
  });

  it('stops before the lane leaves the left edge when it cannot fit beside the panel', () => {
    // a 300 px lane at zoom 1 cannot clear a 900 px panel: keep its left at 16
    expect(
      panXClearOfPanel({
        containerWidth: 980,
        extentLeft: 100,
        extentRight: 400,
        panelWidth: 900,
        x: 0,
        zoom: 1,
      })
    ).toBe(-84);
  });
});

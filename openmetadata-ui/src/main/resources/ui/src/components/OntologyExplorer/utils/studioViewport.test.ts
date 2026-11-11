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
import { rectFitsViewport, rectOfCenters } from './studioViewport';

describe('studio viewport helpers', () => {
  it('grows the rectangle of node centres by the node half size', () => {
    expect(
      rectOfCenters(
        [
          [100, 50],
          [400, 250],
        ],
        75,
        18
      )
    ).toEqual({ minX: 25, maxX: 475, minY: 32, maxY: 268 });
  });

  it('has no rectangle without nodes', () => {
    expect(rectOfCenters([], 75, 18)).toBeUndefined();
  });

  it('fits a rectangle only when all four sides are inside the viewport', () => {
    const size = { width: 800, height: 600 };

    expect(
      rectFitsViewport({ minX: 0, maxX: 800, minY: 0, maxY: 600 }, size)
    ).toBe(true);
    expect(
      rectFitsViewport({ minX: -1, maxX: 700, minY: 10, maxY: 500 }, size)
    ).toBe(false);
    expect(
      rectFitsViewport({ minX: 10, maxX: 700, minY: 10, maxY: 601 }, size)
    ).toBe(false);
  });
});

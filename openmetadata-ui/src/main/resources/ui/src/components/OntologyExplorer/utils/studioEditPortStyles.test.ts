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

import { getStudioEditPortPlusLineStyles } from './studioEditPortStyles';

describe('getStudioEditPortPlusLineStyles', () => {
  it('matches the design SVG and paints above the native G6 port', () => {
    const [horizontal, vertical] = getStudioEditPortPlusLineStyles(75, 20);

    expect(horizontal).toMatchObject({
      lineCap: 'round',
      lineWidth: 1.375,
      pointerEvents: 'none',
      stroke: '#ffffff',
      y1: 20,
      y2: 20,
      zIndex: 3,
    });
    expect(horizontal.x1).toBeCloseTo(71.79, 2);
    expect(horizontal.x2).toBeCloseTo(78.21, 2);

    expect(vertical).toMatchObject({
      lineCap: 'round',
      lineWidth: 1.375,
      pointerEvents: 'none',
      stroke: '#ffffff',
      x1: 75,
      x2: 75,
      zIndex: 3,
    });
    expect(vertical.y1).toBeCloseTo(16.79, 2);
    expect(vertical.y2).toBeCloseTo(23.21, 2);
  });
});

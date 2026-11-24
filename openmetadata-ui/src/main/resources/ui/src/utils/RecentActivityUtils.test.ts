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
import { arraySorterByKey } from './RecentActivityUtils';

type Item = { timestamp: number };

describe('arraySorterByKey comparison branch', () => {
  it('returns -1, 1 and 0 for less-than, greater-than and equal in ascending order', () => {
    const sorter = arraySorterByKey<Item>('timestamp');

    expect(sorter({ timestamp: 1 }, { timestamp: 2 })).toBe(-1);
    expect(sorter({ timestamp: 2 }, { timestamp: 1 })).toBe(1);
    expect(sorter({ timestamp: 1 }, { timestamp: 1 })).toBe(0);
  });

  it('flips the comparison sign in descending order', () => {
    const sorter = arraySorterByKey<Item>('timestamp', true);

    expect(sorter({ timestamp: 1 }, { timestamp: 2 })).toBe(1);
    expect(sorter({ timestamp: 2 }, { timestamp: 1 })).toBe(-1);
    // Equal keys yield 0 * -1 === -0; assert numeric equality with 0.
    expect(sorter({ timestamp: 1 }, { timestamp: 1 })).toBeCloseTo(0);
  });

  it('orders an array descending by the given key', () => {
    const items: Item[] = [
      { timestamp: 2 },
      { timestamp: 1 },
      { timestamp: 3 },
    ];

    expect([...items].sort(arraySorterByKey<Item>('timestamp', true))).toEqual([
      { timestamp: 3 },
      { timestamp: 2 },
      { timestamp: 1 },
    ]);
  });
});

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
  getLayoutDropIndex,
  moveLayoutItem,
} from './CustomPropertiesWidget.utils';

describe('getLayoutDropIndex', () => {
  it('moves an item forward past the target when dropped after it', () => {
    expect(getLayoutDropIndex(0, { index: 2, side: 'after' })).toBe(2);
  });

  it('moves an item forward in front of the target when dropped before it', () => {
    expect(getLayoutDropIndex(0, { index: 2, side: 'before' })).toBe(1);
  });

  it('moves an item backward in front of the target', () => {
    expect(getLayoutDropIndex(3, { index: 1, side: 'before' })).toBe(1);
  });

  it('moves an item backward behind the target', () => {
    expect(getLayoutDropIndex(3, { index: 1, side: 'after' })).toBe(2);
  });

  it('reports no move when the item lands where it already is', () => {
    expect(getLayoutDropIndex(2, { index: 2, side: 'before' })).toBeUndefined();
    expect(getLayoutDropIndex(2, { index: 2, side: 'after' })).toBeUndefined();
    expect(getLayoutDropIndex(2, { index: 1, side: 'after' })).toBeUndefined();
    expect(getLayoutDropIndex(2, { index: 3, side: 'before' })).toBeUndefined();
  });
});

describe('moveLayoutItem', () => {
  it('returns a reordered copy and leaves the input untouched', () => {
    const items = ['a', 'b', 'c', 'd'];

    expect(moveLayoutItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveLayoutItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
});

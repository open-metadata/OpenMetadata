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
import { mergeGridRows } from './GridRowsUtils';

describe('mergeGridRows', () => {
  it('writes edits to the filtered rows back without dropping hidden rows', () => {
    const dataSource = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    const gridRows = [dataSource[2]];

    expect(mergeGridRows(dataSource, gridRows, [{ name: 'c2' }])).toEqual([
      { name: 'a' },
      { name: 'b' },
      { name: 'c2' },
    ]);
  });

  it('uses the updated rows as-is when the grid shows every row', () => {
    const dataSource = [{ name: 'a' }];
    const updated = [{ name: 'a2' }];

    expect(mergeGridRows(dataSource, dataSource, updated)).toBe(updated);
  });
});

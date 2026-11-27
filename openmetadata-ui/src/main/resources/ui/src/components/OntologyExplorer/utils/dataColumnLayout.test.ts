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
import { layoutColumnNodes } from './dataColumnLayout';

const row = (top: number) => ({ height: 64, left: 40, top, width: 380 });
const keys = (count: number, prefix = 'c') =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`);

describe('layoutColumnNodes', () => {
  it('draws nothing for an asset with no bound columns', () => {
    expect(
      layoutColumnNodes([
        { assetId: 'a', columnKeys: [], isShowingAll: false, row: row(100) },
      ])
    ).toEqual({ bottom: 0, edges: [], right: 0, slots: [] });
  });

  it('centres the first column on its row and stacks the rest below, one edge each', () => {
    const { bottom, edges, right, slots } = layoutColumnNodes([
      { assetId: 'a', columnKeys: keys(2), isShowingAll: false, row: row(100) },
    ]);

    expect(slots.map(({ kind, left, top }) => [kind, left, top])).toEqual([
      ['column', 492, 117],
      ['column', 492, 153],
    ]);
    expect(edges.map(({ columnKey, path }) => [columnKey, path])).toEqual([
      ['c0', 'M420 132 C450 132 462 132 492 132'],
      ['c1', 'M420 132 C450 132 462 168 492 168'],
    ]);
    expect(right).toBe(702);
    expect(bottom).toBe(183);
  });

  it('keeps the first five columns and puts the rest behind a +N more node', () => {
    const { edges, slots } = layoutColumnNodes([
      { assetId: 'a', columnKeys: keys(7), isShowingAll: false, row: row(100) },
    ]);

    expect(slots.map(({ kind, top }) => [kind, top])).toEqual([
      ['column', 117],
      ['column', 153],
      ['column', 189],
      ['column', 225],
      ['column', 261],
      ['more', 297],
    ]);
    expect(slots[5]).toMatchObject({ assetId: 'a', hiddenCount: 2 });
    expect(edges).toHaveLength(5);
  });

  it('draws every column and a show-fewer node once the asset is expanded', () => {
    const { edges, slots } = layoutColumnNodes([
      { assetId: 'a', columnKeys: keys(7), isShowingAll: true, row: row(100) },
    ]);

    expect(slots.filter(({ kind }) => kind === 'column')).toHaveLength(7);
    expect(slots[7]).toMatchObject({ kind: 'fewer', top: 117 + 7 * 36 });
    expect(edges).toHaveLength(7);
  });

  it('does not offer show-fewer for an asset at the cap', () => {
    const { slots } = layoutColumnNodes([
      { assetId: 'a', columnKeys: keys(5), isShowingAll: true, row: row(100) },
    ]);

    expect(slots.map(({ kind }) => kind)).toEqual(Array(5).fill('column'));
  });

  it('pushes the next asset past the columns of the one above', () => {
    const { slots } = layoutColumnNodes([
      {
        assetId: 'b',
        columnKeys: keys(3, 'b'),
        isShowingAll: false,
        row: row(164),
      },
      {
        assetId: 'a',
        columnKeys: keys(2, 'a'),
        isShowingAll: false,
        row: row(100),
      },
    ]);

    expect(slots.map(({ assetId, top }) => [assetId, top])).toEqual([
      ['a', 117],
      ['a', 153],
      ['b', 195],
      ['b', 231],
      ['b', 267],
    ]);
  });
});

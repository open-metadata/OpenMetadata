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
import type { ColumnType } from './Table.interface';
import { resolveCellValue } from './TableV2Utils';

type Row = Record<string, unknown>;

const buildColumn = (partial: Partial<ColumnType<Row>>): ColumnType<Row> =>
  partial as ColumnType<Row>;

describe('resolveCellValue rawValue branch', () => {
  it('walks a nested path when dataIndex is an array', () => {
    const value = resolveCellValue(
      buildColumn({ dataIndex: ['a', 'b'] }),
      { a: { b: 'nested-value' } },
      0
    );

    expect(value).toBe('nested-value');
  });

  it('reads a top-level key when dataIndex is a string', () => {
    expect(
      resolveCellValue(buildColumn({ dataIndex: 'name' }), { name: 'hello' }, 0)
    ).toBe('hello');
    expect(
      resolveCellValue(buildColumn({ dataIndex: 'count' }), { count: 5 }, 0)
    ).toBe('5');
  });

  it('returns null when dataIndex is undefined', () => {
    expect(resolveCellValue(buildColumn({}), {}, 0)).toBeNull();
  });
});

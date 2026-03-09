/*
 *  Copyright 2024 Collate.
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
  buildSampleDataCSVContent,
  stringifySampleDataValue,
} from './SampleDataTable.utils';

describe('stringifySampleDataValue', () => {
  it('returns empty string for null', () => {
    expect(stringifySampleDataValue(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(stringifySampleDataValue(undefined as unknown as null)).toBe('');
  });

  it('returns JSON string for plain objects', () => {
    expect(stringifySampleDataValue({ key: 'val' })).toBe('{"key":"val"}');
  });

  it('returns JSON string for arrays', () => {
    expect(stringifySampleDataValue([1, 2, 3])).toBe('[1,2,3]');
  });

  it('returns the string as-is for string values', () => {
    expect(stringifySampleDataValue('hello')).toBe('hello');
  });

  it('returns string representation for numbers', () => {
    expect(stringifySampleDataValue(42)).toBe('42');
  });

  it('returns string representation for zero', () => {
    expect(stringifySampleDataValue(0)).toBe('0');
  });
});

describe('buildSampleDataCSVContent', () => {
  const columns = ['id', 'name', 'age'];
  const rows = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 25 },
    { id: 3, name: 'Carol', age: 35 },
  ];

  it('produces a CSV with a header row', () => {
    const csv = buildSampleDataCSVContent(columns, rows, 10);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('id,name,age');
  });

  it('produces correct data rows', () => {
    const csv = buildSampleDataCSVContent(columns, rows, 10);
    const lines = csv.split('\n');

    expect(lines[1]).toBe('1,Alice,30');
    expect(lines[2]).toBe('2,Bob,25');
  });

  it('respects rowLimit and does not include rows beyond the limit', () => {
    const csv = buildSampleDataCSVContent(columns, rows, 2);
    const lines = csv.split('\n').filter(Boolean);

    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('handles null cell values as empty strings', () => {
    const csv = buildSampleDataCSVContent(
      ['a', 'b'],
      [{ a: null, b: null }],
      10
    );
    const dataLine = csv.split('\n')[1];

    expect(dataLine).toBe(',');
  });

  it('quotes values that contain commas', () => {
    const csv = buildSampleDataCSVContent(
      ['col'],
      [{ col: 'hello, world' }],
      10
    );

    expect(csv).toContain('"hello, world"');
  });

  it('quotes values that contain double quotes, escaping them', () => {
    const csv = buildSampleDataCSVContent(['col'], [{ col: 'say "hi"' }], 10);

    expect(csv).toContain('"say ""hi"""');
  });

  it('quotes values that contain newlines', () => {
    const csv = buildSampleDataCSVContent(
      ['col'],
      [{ col: 'line1\nline2' }],
      10
    );

    expect(csv).toContain('"line1\nline2"');
  });

  it('serializes object values as JSON in RFC 4180 encoding', () => {
    const csv = buildSampleDataCSVContent(
      ['meta'],
      [{ meta: { nested: true } }],
      10
    );

    // papaparse wraps values with special chars in quotes and escapes internal quotes
    expect(csv).toContain('"{""nested"":true}"');
  });

  it('returns empty string when rows array is empty', () => {
    // papaparse returns empty string when data array is empty
    const csv = buildSampleDataCSVContent(columns, [], 10);

    expect(csv).toBe('');
  });
});

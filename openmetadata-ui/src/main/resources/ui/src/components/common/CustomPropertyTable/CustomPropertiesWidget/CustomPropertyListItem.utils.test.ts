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
import { TFunction } from 'i18next';
import { getPropertyValueSummary } from './CustomPropertyListItem.utils';

const t = ((key: string, options?: { count?: number }) =>
  options?.count === undefined
    ? key
    : `${key}:${options.count}`) as unknown as TFunction;

const summarize = (typeName: string | undefined, value: unknown) =>
  getPropertyValueSummary(typeName, value, t, 'en-US');

const HOUR_MS = 60 * 60 * 1000;

describe('getPropertyValueSummary', () => {
  it('counts the rows of a table value', () => {
    expect(
      summarize('table-cp', {
        columns: ['name'],
        rows: [{ name: 'a' }, { name: 'b' }],
      })
    ).toBe('label.count-row-plural:2');
  });

  it('reports zero rows for a table without rows', () => {
    expect(summarize('table-cp', { columns: ['name'], rows: [] })).toBe(
      'label.count-row-plural:0'
    );
  });

  it('counts the lines of a sql query', () => {
    expect(summarize('sqlQuery', 'SELECT 1\nFROM dual\nWHERE 1 = 1')).toBe(
      'label.count-line-plural:3'
    );
  });

  it('strips the html of a markdown value', () => {
    expect(summarize('markdown', '<p><strong>Owned</strong> by data</p>')).toBe(
      'Owned by data'
    );
  });

  it('shows the duration of a time interval', () => {
    expect(summarize('timeInterval', { start: 0, end: 2 * HOUR_MS })).toBe(
      '2 hours'
    );
  });

  it('prefers the display text of a hyperlink and falls back to its url', () => {
    expect(
      summarize('hyperlink-cp', {
        url: 'https://example.com',
        displayText: 'Runbook',
      })
    ).toBe('Runbook');
    expect(summarize('hyperlink-cp', { url: 'https://example.com' })).toBe(
      'https://example.com'
    );
    expect(summarize('hyperlink-cp', {})).toBe('');
  });

  it('names a single entity reference', () => {
    expect(
      summarize('entityReference', {
        id: '1',
        type: 'user',
        name: 'priya',
        displayName: 'Priya',
      })
    ).toBe('Priya');
  });

  it('joins the names of an entity reference list and skips non-objects', () => {
    expect(
      summarize('entityReferenceList', [
        { id: '1', type: 'table', name: 'orders' },
        'broken',
        { id: '2', type: 'table', name: 'customers' },
      ])
    ).toBe('orders, customers');
  });

  it('joins multi-select enum values and prints a single one as is', () => {
    expect(summarize('enum', ['Gold', 'Tier 1'])).toBe('Gold, Tier 1');
    expect(summarize('enum', 'Silver')).toBe('Silver');
  });

  it('formats a timestamp as a date-time', () => {
    expect(summarize('timestamp', '1758542400000')).toMatch(/2025/);
  });

  it('prints other values as strings', () => {
    expect(summarize('integer', 42)).toBe('42');
    expect(summarize(undefined, 'plain')).toBe('plain');
  });
});

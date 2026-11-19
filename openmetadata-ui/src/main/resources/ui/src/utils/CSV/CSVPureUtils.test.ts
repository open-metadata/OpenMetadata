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
import { parse } from 'papaparse';
import { normalizeCsvLineBreaks } from './CSVPureUtils';

describe('normalizeCsvLineBreaks', () => {
  // Three exported rows end in CRLF; the two rows appended afterwards end in LF.
  const mixedEndings =
    'name*,entityType*\r\ncustomer_orders,table\r\norder_id,column\r\n' +
    'order_total,column\r\nstore_footfall_daily,table\nvisitors,column\n';

  const parseRows = (content: string) =>
    parse<string[]>(content, { skipEmptyLines: true }).data;

  it('keeps every row once the line breaks are normalized', () => {
    const rows = parseRows(normalizeCsvLineBreaks(mixedEndings));

    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row[0])).toEqual([
      'name*',
      'customer_orders',
      'order_id',
      'order_total',
      'store_footfall_daily',
      'visitors',
    ]);
  });

  it('rewrites CRLF and lone CR as LF', () => {
    expect(normalizeCsvLineBreaks('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });

  it('treats a quote inside an unquoted cell as text', () => {
    const inches =
      'name*,description\r\npipes,12" pipe\r\nfittings,Elbow joint\r\nvalves,3" valve\r\n';

    const rows = parseRows(normalizeCsvLineBreaks(inches));

    expect(rows).toEqual([
      ['name*', 'description'],
      ['pipes', '12" pipe'],
      ['fittings', 'Elbow joint'],
      ['valves', '3" valve'],
    ]);
  });

  it('keeps line breaks inside quoted cells', () => {
    const quoted =
      'name*,description\r\norders,"Line one\r\nLine two ""quoted"""\r\nvisits,Daily\n';

    const rows = parseRows(normalizeCsvLineBreaks(quoted));

    expect(rows).toEqual([
      ['name*', 'description'],
      ['orders', 'Line one\r\nLine two "quoted"'],
      ['visits', 'Daily'],
    ]);
  });
});

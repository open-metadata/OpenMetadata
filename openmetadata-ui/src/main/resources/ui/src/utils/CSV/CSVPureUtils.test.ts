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
import type { Column } from 'react-data-grid';
import { getCsvGridRowHeight, getFailedImportRowIds } from './CSVPureUtils';

type GridColumn = Column<Record<string, string>>;

// Five short chip labels: each estimates to a 29px chip (2 chars * 6.5 + 16),
// packed greedily with a 6px gap into (columnWidth - 36) available px.
const FIVE_CHIP_VALUE = 'aa;bb;cc;dd;ee';

const buildColumn = (partial: Partial<GridColumn>): GridColumn =>
  ({ key: 'tags', name: 'Tags', ...partial } as GridColumn);

describe('getCsvGridRowHeight columnWidth branch', () => {
  it('uses column.width when it is a number (wide width fits all chips on one line)', () => {
    const columns = [buildColumn({ width: 1000 })];

    expect(getCsvGridRowHeight({ tags: FIVE_CHIP_VALUE }, columns)).toBe(44);
  });

  it('uses column.width when it is a number (narrow width wraps every chip)', () => {
    const columns = [buildColumn({ width: 40 })];

    // available = max(1, 40 - 36) = 4 -> each of the 5 chips wraps -> 5 lines
    expect(getCsvGridRowHeight({ tags: FIVE_CHIP_VALUE }, columns)).toBe(
      44 + 4 * 26
    );
  });

  it('falls back to column.minWidth when width is not a number', () => {
    const narrow = [buildColumn({ minWidth: 40 })];
    const wide = [buildColumn({ minWidth: 1000 })];

    // minWidth 40 -> 5 lines; minWidth 1000 -> single line (proves minWidth,
    // not the 200px default, was used)
    expect(getCsvGridRowHeight({ tags: FIVE_CHIP_VALUE }, narrow)).toBe(
      44 + 4 * 26
    );
    expect(getCsvGridRowHeight({ tags: FIVE_CHIP_VALUE }, wide)).toBe(44);
  });

  it('falls back to the default chip column width when neither width nor minWidth is set', () => {
    const columns = [buildColumn({})];

    // default 200 -> available 164 -> four chips fit, fifth wraps -> 2 lines
    expect(getCsvGridRowHeight({ tags: FIVE_CHIP_VALUE }, columns)).toBe(
      44 + 26
    );
  });

  it('returns the base height for non-chip columns and single-chip rows', () => {
    const nonChip = [buildColumn({ key: 'description', width: 40 })];
    const singleChip = [buildColumn({ width: 40 })];

    expect(getCsvGridRowHeight({ description: FIVE_CHIP_VALUE }, nonChip)).toBe(
      44
    );
    expect(getCsvGridRowHeight({ tags: 'only-one' }, singleChip)).toBe(44);
  });

  it('honours a custom base row height', () => {
    const columns = [buildColumn({ width: 1000 })];

    expect(getCsvGridRowHeight({ tags: FIVE_CHIP_VALUE }, columns, 60)).toBe(
      60
    );
  });
});

describe('getFailedImportRowIds', () => {
  const submittedCsv = [
    'parent,name*,description',
    ',Churn,first',
    ',Customer,second',
    ',Order,third',
  ].join('\n');

  it('matches failures by row values when the server writes them out of order', () => {
    const importResultsCsv = [
      'status,details,parent,name*,description',
      'failure,Missing owner,,Order,third',
      'success,Entity updated,,Churn,first',
      'failure,"Tags a, b are mutually exclusive",,Customer,second',
    ].join('\n');

    expect(
      [...getFailedImportRowIds({ importResultsCsv, submittedCsv })].sort()
    ).toEqual(['1', '2']);
  });

  it('maps failures to the ids of the rows that were submitted', () => {
    const importResultsCsv = [
      'status,details,parent,name*,description',
      'failure,Missing owner,,Customer,second',
    ].join('\n');

    expect([
      ...getFailedImportRowIds({
        importResultsCsv,
        submittedCsv,
        submittedRowIds: ['7', '12', '30'],
      }),
    ]).toEqual(['12']);
  });

  it('claims each identical failed record once', () => {
    const duplicateCsv = ['name*,description', 'A,x', 'A,x'].join('\n');
    const importResultsCsv = [
      'status,details,name*,description',
      'success,ok,A,x',
      'failure,bad,A,x',
    ].join('\n');

    expect(
      getFailedImportRowIds({ importResultsCsv, submittedCsv: duplicateCsv })
        .size
    ).toBe(1);
  });

  it('returns no ids without a result', () => {
    expect(getFailedImportRowIds({ submittedCsv }).size).toBe(0);
  });
});

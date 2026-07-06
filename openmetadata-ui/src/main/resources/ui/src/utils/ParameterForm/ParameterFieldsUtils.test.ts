/*
 *  Copyright 2025 Collate.
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
  TestDataType,
  TestDefinition,
} from '../../generated/tests/testDefinition';
import {
  normalizeParamsForPayload,
  restoreParamName,
  sanitizeParamName,
  unwrapSelectValue,
  unwrapSelectValues,
} from './ParameterFieldsUtils';

describe('sanitizeParamName / restoreParamName', () => {
  it('sanitizes dotted names with the sentinel', () => {
    expect(sanitizeParamName('table2.keyColumns')).toBe('table2___keyColumns');
  });

  it('restores sanitized names back to dotted form', () => {
    expect(restoreParamName('table2___keyColumns')).toBe('table2.keyColumns');
  });

  it('leaves non-dotted names unchanged on round-trip', () => {
    expect(sanitizeParamName('columnName')).toBe('columnName');
    expect(restoreParamName('columnName')).toBe('columnName');
  });
});

describe('unwrapSelectValue', () => {
  it('returns the id of a FormSelectItem', () => {
    expect(unwrapSelectValue({ id: 'col1', label: 'Column 1' })).toBe('col1');
  });

  it('returns a plain string unchanged', () => {
    expect(unwrapSelectValue('col1')).toBe('col1');
  });

  it('returns undefined for undefined', () => {
    expect(unwrapSelectValue(undefined)).toBeUndefined();
  });
});

describe('unwrapSelectValues', () => {
  it('maps a FormSelectItem[] to a string[] of ids', () => {
    expect(
      unwrapSelectValues([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ])
    ).toEqual(['a', 'b']);
  });

  it('maps a string[] unchanged', () => {
    expect(unwrapSelectValues(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('handles a mixed array of strings and FormSelectItems', () => {
    expect(unwrapSelectValues(['a', { id: 'b' }])).toEqual(['a', 'b']);
  });

  it('returns undefined for undefined', () => {
    expect(unwrapSelectValues(undefined)).toBeUndefined();
  });
});

describe('normalizeParamsForPayload', () => {
  it('returns undefined when rawParams is undefined', () => {
    expect(normalizeParamsForPayload(undefined, undefined)).toBeUndefined();
  });

  it('unwraps a scalar FormSelectItem to its raw id', () => {
    const result = normalizeParamsForPayload(
      { columnName: { id: 'c1', label: 'Column 1' } },
      undefined
    );

    expect(result).toEqual({ columnName: 'c1' });
  });

  it('unwraps an array of { value: FormSelectItem } to { value: id }', () => {
    const result = normalizeParamsForPayload(
      {
        keyColumns: [{ value: { id: 'c1' } }, { value: { id: 'c2' } }],
      },
      undefined
    );

    expect(result).toEqual({
      keyColumns: [{ value: 'c1' }, { value: 'c2' }],
    });
  });

  it('keeps an array of { value: string } untouched', () => {
    const result = normalizeParamsForPayload(
      { keyColumns: [{ value: 'c1' }, { value: 'c2' }] },
      undefined
    );

    expect(result).toEqual({
      keyColumns: [{ value: 'c1' }, { value: 'c2' }],
    });
  });

  it('restores a sanitized dotted key to its literal form', () => {
    const result = normalizeParamsForPayload(
      { table2___keyColumns: [{ value: { id: 'c1' } }] },
      undefined
    );

    expect(result).toEqual({
      'table2.keyColumns': [{ value: 'c1' }],
    });
  });

  it('passes string, number and boolean values through unchanged', () => {
    const result = normalizeParamsForPayload(
      { minValue: '00123', maxValue: 5, enabled: true },
      undefined
    );

    expect(result).toEqual({ minValue: '00123', maxValue: 5, enabled: true });
  });

  it('round-trips a realistic tableDiff-like params object', () => {
    const result = normalizeParamsForPayload(
      {
        table2: { id: 'svc.db.sch.t2', label: 'svc.db.sch.t2' },
        keyColumns: [{ value: { id: 'id' } }, { value: { id: 'name' } }],
        table2___keyColumns: [{ value: { id: 'id2' } }],
        useColumns: [{ value: { id: 'email' } }],
        threshold: '0',
      },
      {
        parameterDefinition: [
          { name: 'keyColumns', dataType: TestDataType.Array },
          { name: 'table2.keyColumns', dataType: TestDataType.Array },
          { name: 'useColumns', dataType: TestDataType.Array },
        ],
      } as TestDefinition
    );

    expect(result).toEqual({
      table2: 'svc.db.sch.t2',
      keyColumns: [{ value: 'id' }, { value: 'name' }],
      'table2.keyColumns': [{ value: 'id2' }],
      useColumns: [{ value: 'email' }],
      threshold: '0',
    });
  });
});

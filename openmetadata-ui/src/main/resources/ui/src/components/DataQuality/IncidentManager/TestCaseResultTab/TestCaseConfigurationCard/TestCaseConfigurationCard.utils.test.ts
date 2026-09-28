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
import { TestCase } from '../../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../../generated/tests/testDefinition';
import {
  getCategoryTranslation,
  getConfigurationShapes,
  getDefinitionDisplayName,
  toSqlLines,
} from './TestCaseConfigurationCard.utils';

const baseArgs = {
  testCaseData: {} as TestCase,
  parameterRows: [],
  withSqlParams: [],
  isVersionPage: false,
  versionParameterDiff: undefined,
};

describe('getConfigurationShapes', () => {
  it('reports empty when nothing has anything to render', () => {
    expect(getConfigurationShapes(baseArgs)).toEqual({
      hasVersionDiff: false,
      hasParameterRows: false,
      hasSql: false,
      isDynamicAssertion: false,
      isEmpty: true,
    });
  });

  it('treats parameters and SQL as independent, not exclusive', () => {
    const shapes = getConfigurationShapes({
      ...baseArgs,
      parameterRows: [{ label: 'Strategy', value: 'ROWS' }],
      withSqlParams: [{ name: 'sqlExpression', value: 'SELECT 1' }],
    });

    expect(shapes.hasParameterRows).toBe(true);
    expect(shapes.hasSql).toBe(true);
    expect(shapes.isEmpty).toBe(false);
  });

  it('suppresses the assertion SQL on a version page', () => {
    const shapes = getConfigurationShapes({
      ...baseArgs,
      isVersionPage: true,
      withSqlParams: [{ name: 'sqlExpression', value: 'SELECT 1' }],
      versionParameterDiff: 'diff',
    });

    expect(shapes.hasSql).toBe(false);
    expect(shapes.hasVersionDiff).toBe(true);
    expect(shapes.isEmpty).toBe(false);
  });

  it('is not empty when only the dynamic assertion applies', () => {
    const shapes = getConfigurationShapes({
      ...baseArgs,
      testCaseData: { useDynamicAssertion: true } as TestCase,
    });

    expect(shapes.isDynamicAssertion).toBe(true);
    expect(shapes.isEmpty).toBe(false);
  });
});

describe('getDefinitionDisplayName', () => {
  it('prefers the display name', () => {
    expect(
      getDefinitionDisplayName({
        name: 'tableRowCountToEqual',
        displayName: 'Table Row Count To Equal',
      } as TestDefinition)
    ).toBe('Table Row Count To Equal');
  });

  it('start-cases the raw name when no display name is set', () => {
    expect(
      getDefinitionDisplayName({
        name: 'tableRowCountToEqual',
      } as TestDefinition)
    ).toBe('Table Row Count To Equal');
  });

  it('returns an empty string when the definition has not loaded', () => {
    expect(getDefinitionDisplayName(undefined)).toBe('');
  });
});

describe('toSqlLines', () => {
  it('numbers lines from one', () => {
    expect(toSqlLines('SELECT 1\nFROM t').map((l) => l.number)).toEqual([1, 2]);
  });

  it('marks keywords case-insensitively and leaves identifiers alone', () => {
    const [line] = toSqlLines('select email from customers');
    const keywords = line.tokens
      .filter((token) => token.isKeyword)
      .map((token) => token.text);

    expect(keywords).toEqual(['select', 'from']);
  });

  it('round-trips the original text so indentation survives', () => {
    const sql = 'SELECT  COUNT(*)\n  FROM   customers;';

    const rebuilt = toSqlLines(sql)
      .map((line) => line.tokens.map((token) => token.text).join(''))
      .join('\n');

    expect(rebuilt).toBe(sql);
  });

  it('does not treat a keyword substring as a keyword', () => {
    const [line] = toSqlLines('SELECT selection FROM t');

    expect(
      line.tokens.find((token) => token.text === 'selection')?.isKeyword
    ).toBe(false);
  });
});

describe('getCategoryTranslation', () => {
  it('names the column for a column test', () => {
    expect(
      getCategoryTranslation(
        '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::zip>'
      )
    ).toEqual({
      key: 'label.column-test-with-column',
      options: { column: 'zip' },
    });
  });

  it('falls back to a table test when the link has no column', () => {
    expect(
      getCategoryTranslation(
        '<#E::table::sample_data.ecommerce_db.shopify.dim_address>'
      )
    ).toEqual({ key: 'label.table-test' });
  });

  it('treats a missing entity link as a table test', () => {
    expect(getCategoryTranslation(undefined)).toEqual({
      key: 'label.table-test',
    });
  });
});

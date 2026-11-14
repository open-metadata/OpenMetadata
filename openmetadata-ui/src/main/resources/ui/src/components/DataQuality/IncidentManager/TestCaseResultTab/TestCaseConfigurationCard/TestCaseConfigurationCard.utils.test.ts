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
import type { TFunction } from 'i18next';
import { TestCase } from '../../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../../generated/tests/testDefinition';
import {
  getCategoryTranslation,
  getConfigurationShapes,
  getConfiguredThresholdSentence,
  getDefinitionDisplayName,
  toSqlLines,
} from './TestCaseConfigurationCard.utils';

// The sentence is the feature, so it is read in English rather than as keys.
// A hoisted function, as constants translate when their module is imported.
function mockTranslate(key: string, options?: Record<string, unknown>) {
  const catalog: Record<string, Record<string, string>> = jest.requireActual(
    '../../../../../locale/languages/en-us.json'
  );
  const [namespace, ...rest] = key.split('.');
  const template = catalog[namespace]?.[rest.join('.')] ?? key;

  return Object.entries(options ?? {}).reduce(
    (result, [name, value]) => result.split(`{{${name}}}`).join(String(value)),
    template
  );
}

const translate = mockTranslate as TFunction;

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

describe('getConfiguredThresholdSentence', () => {
  const thresholdDefinition = (name: string) =>
    ({
      name,
      parameterDefinition: [
        { name: 'threshold' },
        { name: 'thresholdUnit', optionValues: ['ABSOLUTE', 'PERCENTAGE'] },
      ],
    } as TestDefinition);

  it('restates a row tolerance on the column it is about', () => {
    expect(
      getConfiguredThresholdSentence(
        {
          entityLink: '<#E::table::svc.db.schema.users::columns::email>',
          parameterValues: [
            { name: 'threshold', value: '1' },
            { name: 'thresholdUnit', value: 'PERCENTAGE' },
          ],
        } as TestCase,
        thresholdDefinition('columnValuesToMatchRegex'),
        translate
      )
    ).toBe(
      'Fail when more than 1% of non-null values in email fail this test.'
    );
  });

  it('restates a deviation on a table test with its widened range', () => {
    expect(
      getConfiguredThresholdSentence(
        {
          entityLink: '<#E::table::svc.db.schema.users>',
          parameterValues: [
            { name: 'minValue', value: '90' },
            { name: 'maxValue', value: '110' },
            { name: 'threshold', value: '5' },
            { name: 'thresholdUnit', value: 'PERCENTAGE' },
          ],
        } as TestCase,
        thresholdDefinition('tableRowCountToBeBetween'),
        translate
      )
    ).toBe(
      'Fail when the measured value falls outside 90 – 110, allowing a deviation of 5% (effective range 85.5 – 115.5).'
    );
  });

  it('reads a test case with no threshold set as tolerating nothing', () => {
    expect(
      getConfiguredThresholdSentence(
        {
          entityLink: '<#E::table::svc.db.schema.users::columns::email>',
          parameterValues: [],
        } as unknown as TestCase,
        thresholdDefinition('columnValuesToBeNotNull'),
        translate
      )
    ).toBe('Fail when more than 0 row(s) in email fail this test.');
  });

  it('says nothing for a dynamic assertion, whose bounds are learned', () => {
    // Stale bounds left in the parameters are not what the test checks.
    expect(
      getConfiguredThresholdSentence(
        {
          entityLink: '<#E::table::svc.db.schema.users>',
          useDynamicAssertion: true,
          parameterValues: [
            { name: 'minValue', value: '90' },
            { name: 'maxValue', value: '110' },
            { name: 'threshold', value: '5' },
          ],
        } as TestCase,
        thresholdDefinition('tableRowCountToBeBetween'),
        translate
      )
    ).toBeUndefined();
  });

  it('says nothing for a test that has no threshold parameter', () => {
    expect(
      getConfiguredThresholdSentence(
        { entityLink: '<#E::table::svc.db.schema.users>' } as TestCase,
        {
          name: 'tableColumnNameToExist',
          parameterDefinition: [],
        } as unknown as TestDefinition,
        translate
      )
    ).toBeUndefined();
  });
});

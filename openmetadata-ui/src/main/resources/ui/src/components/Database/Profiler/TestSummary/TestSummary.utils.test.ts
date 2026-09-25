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
import { TestCase } from '../../../../generated/tests/testCase';
import { getResultHistoryCaption } from './TestSummary.utils';

const TABLE_LINK = '<#E::table::svc.db.schema.orders>';
const columnLink = (column: string) =>
  `<#E::table::svc.db.schema.orders::columns::${column}>`;

const testCase = (
  definition: string,
  parameters: Record<string, string>,
  overrides: Partial<TestCase> = {}
) =>
  ({
    entityLink: TABLE_LINK,
    testDefinition: { id: 'id', type: 'testDefinition', name: definition },
    parameterValues: Object.entries(parameters).map(([name, value]) => ({
      name,
      value,
    })),
    ...overrides,
  } as TestCase);

describe('getResultHistoryCaption', () => {
  // The five shapes the mock draws.
  it('should read an expected value with its percentage tolerance', () => {
    expect(
      getResultHistoryCaption(
        testCase('tableRowCountToEqual', {
          value: '10000',
          threshold: '5',
          thresholdUnit: 'PERCENTAGE',
        })
      )
    ).toEqual({
      metric: { key: 'label.result-metric-row-count' },
      comparison: {
        key: 'label.caption-expected-value',
        values: { value: (10000).toLocaleString() },
      },
      tolerance: { key: 'label.caption-tolerance', values: { value: '5%' } },
    });
  });

  it('should name the column and read a two-sided range', () => {
    expect(
      getResultHistoryCaption(
        testCase(
          'columnValueMaxToBeBetween',
          { minValueForMaxInCol: '1', maxValueForMaxInCol: '3489' },
          { entityLink: columnLink('customer_id') }
        )
      )
    ).toEqual({
      metric: {
        key: 'label.result-metric-column-max',
        values: { column: 'customer_id' },
      },
      comparison: {
        key: 'label.caption-allowed-range',
        values: { min: '1', max: (3489).toLocaleString() },
      },
    });
  });

  it('should read a dynamic assertion as a learned range', () => {
    expect(
      getResultHistoryCaption(
        testCase(
          'columnValuesToBeBetween',
          {},
          {
            entityLink: columnLink('customer_id'),
            useDynamicAssertion: true,
          }
        )
      )
    ).toEqual({
      metric: { key: 'label.result-metric-values' },
      comparison: { key: 'label.caption-learned-range' },
    });
  });

  it('should read a custom query against its threshold', () => {
    expect(
      getResultHistoryCaption(
        testCase('tableCustomSQLQuery', {
          sqlExpression: 'SELECT 1',
          threshold: '0',
        })
      )
    ).toEqual({
      metric: { key: 'label.result-metric-query-result' },
      comparison: {
        key: 'label.caption-threshold',
        values: { value: '0' },
      },
    });
  });

  // Uniqueness states no parameter: zero duplicates is what the test means.
  it('should read the zero a uniqueness test implies', () => {
    expect(
      getResultHistoryCaption(
        testCase('columnValuesToBeUnique', {}, { entityLink: columnLink('id') })
      )
    ).toEqual({
      metric: { key: 'label.result-metric-duplicate-count' },
      comparison: {
        key: 'label.caption-expected-value',
        values: { value: '0' },
      },
    });
  });

  it('should read one-sided bounds', () => {
    expect(
      getResultHistoryCaption(
        testCase('tableRowCountToBeBetween', { maxValue: '750' })
      ).comparison
    ).toEqual({ key: 'label.caption-allowed-max', values: { value: '750' } });
    expect(
      getResultHistoryCaption(
        testCase('tableRowCountToBeBetween', { minValue: '500' })
      ).comparison
    ).toEqual({ key: 'label.caption-allowed-min', values: { value: '500' } });
  });

  it('should write an absolute tolerance without a percent sign', () => {
    expect(
      getResultHistoryCaption(
        testCase('tableRowCountToEqual', {
          value: '100',
          threshold: '5',
          thresholdUnit: 'ABSOLUTE',
        })
      ).tolerance
    ).toEqual({ key: 'label.caption-tolerance', values: { value: '5' } });
  });

  // A zero tolerance is no tolerance: "±0%" says nothing the expectation does
  // not already say.
  it('should leave out a zero tolerance', () => {
    expect(
      getResultHistoryCaption(
        testCase('tableRowCountToEqual', { value: '100', threshold: '0' })
      ).tolerance
    ).toBeUndefined();
  });

  it('should fall back to values for a definition it does not know', () => {
    expect(getResultHistoryCaption(testCase('myCustomTest', {}))).toEqual({
      metric: { key: 'label.result-metric-values' },
    });
  });
});

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
import { ProfileSampleType } from '../../generated/entity/data/table';
import { TestDefinition } from '../../generated/tests/testDefinition';
import enUs from '../../locale/languages/en-us.json';
import {
  getParamSelectOptions,
  getThresholdPreview,
  getThresholdTestSemantic,
  getThresholdUnitLabel,
  hasThresholdUnitParam,
  ThresholdTestSemantic,
} from './TestCaseThresholdUtils';

// Resolve against the real catalog rather than echoing keys back: the point of
// this feature is the wording, so the assertions below read as the sentences a
// user actually sees.
const catalog = enUs as unknown as Record<string, Record<string, string>>;
const t = ((key: string, options?: Record<string, unknown>) => {
  const [namespace, ...rest] = key.split('.');
  const template = catalog[namespace]?.[rest.join('.')] ?? key;

  return Object.entries(options ?? {}).reduce(
    (result, [name, value]) => result.split(`{{${name}}}`).join(String(value)),
    template
  );
}) as unknown as TFunction;

const thresholdParams = [
  { name: 'threshold' },
  { name: 'thresholdUnit', optionValues: ['ABSOLUTE', 'PERCENTAGE'] },
];

const definitionOf = (
  name: string,
  extraParams: { name: string; optionValues?: string[] }[] = []
): TestDefinition =>
  ({
    name,
    parameterDefinition: [...extraParams, ...thresholdParams],
  } as TestDefinition);

describe('getThresholdTestSemantic', () => {
  it.each([
    ['columnValuesToMatchRegex', ThresholdTestSemantic.RowCountable],
    ['columnValuesToBeBetween', ThresholdTestSemantic.RowCountable],
    ['columnValueToBeAtExpectedLocation', ThresholdTestSemantic.RowCountable],
    ['columnValueMeanToBeBetween', ThresholdTestSemantic.Statistical],
    ['tableRowCountToEqual', ThresholdTestSemantic.Statistical],
    ['tableCustomSQLQuery', ThresholdTestSemantic.CustomSql],
  ])('classifies %s as %s', (name, expected) => {
    expect(getThresholdTestSemantic(name)).toBe(expected);
  });
});

describe('getThresholdUnitLabel', () => {
  it.each([
    ['columnValuesToMatchRegex', 'ABSOLUTE', 'rows'],
    ['columnValuesToMatchRegex', 'PERCENTAGE', '% of non-null values'],
    ['columnValuesToBeNotNull', 'PERCENTAGE', '% of rows'],
    ['columnValueMeanToBeBetween', 'ABSOLUTE', 'units'],
    ['columnValueMeanToBeBetween', 'PERCENTAGE', '% of the bound'],
    ['tableCustomSQLQuery', 'ABSOLUTE', 'rows'],
    ['tableCustomSQLQuery', 'PERCENTAGE', '% of table rows'],
  ])('resolves %s + %s to "%s"', (name, unit, expected) => {
    expect(getThresholdUnitLabel(unit, name, t)).toBe(expected);
  });

  it('falls back to the raw id for a unit it does not know', () => {
    expect(getThresholdUnitLabel('FURLONGS', 'columnValuesToBeUnique', t)).toBe(
      'FURLONGS'
    );
  });
});

describe('getParamSelectOptions', () => {
  it('labels operators as sentences while keeping the raw id', () => {
    const options = getParamSelectOptions(
      'tableCustomSQLQuery',
      { name: 'operator', optionValues: ['<=', '<', '>=', '>', '==', '!='] },
      t
    );

    expect(options).toEqual([
      { id: '<=', label: 'at most' },
      { id: '<', label: 'fewer than' },
      { id: '>=', label: 'at least' },
      { id: '>', label: 'more than' },
      { id: '==', label: 'exactly' },
      { id: '!=', label: 'anything other than' },
    ]);
  });

  it('labels strategy and dimension failure policy as sentences', () => {
    expect(
      getParamSelectOptions(
        'tableCustomSQLQuery',
        { name: 'strategy', optionValues: ['ROWS', 'COUNT'] },
        t
      )
    ).toEqual([
      { id: 'ROWS', label: 'count the rows the query returns' },
      { id: 'COUNT', label: 'use the single number the query returns' },
    ]);

    expect(
      getParamSelectOptions(
        'columnValuesToBeNotNull',
        {
          name: 'dimensionFailurePolicy',
          optionValues: ['OVERALL_ONLY', 'ANY_DIMENSION'],
        },
        t
      )
    ).toEqual([
      { id: 'OVERALL_ONLY', label: 'only the overall result decides' },
      { id: 'ANY_DIMENSION', label: 'any breaching group fails the test' },
    ]);
  });

  it('leaves enums it has no sentence for as stored', () => {
    expect(
      getParamSelectOptions(
        'tableRowInsertedCountToBeBetween',
        { name: 'rangeType', optionValues: ['HOUR', 'DAY'] },
        t
      )
    ).toEqual([
      { id: 'HOUR', label: 'HOUR' },
      { id: 'DAY', label: 'DAY' },
    ]);
  });

  it('does not borrow the custom SQL operator wording for other tests', () => {
    expect(
      getParamSelectOptions(
        'someOtherTest',
        { name: 'operator', optionValues: ['<='] },
        t
      )
    ).toEqual([{ id: '<=', label: '<=' }]);
  });
});

describe('hasThresholdUnitParam', () => {
  it('is false for a definition without the param', () => {
    expect(
      hasThresholdUnitParam({
        name: 'tableDiff',
        parameterDefinition: [{ name: 'threshold' }],
      } as TestDefinition)
    ).toBe(false);
  });

  it('is true for a definition with it', () => {
    expect(hasThresholdUnitParam(definitionOf('columnValuesToBeUnique'))).toBe(
      true
    );
  });
});

describe('getThresholdPreview', () => {
  it('returns nothing for a definition without a threshold unit', () => {
    expect(
      getThresholdPreview(
        {
          definition: {
            name: 'tableDiff',
            parameterDefinition: [{ name: 'threshold' }],
          } as TestDefinition,
          params: { threshold: 5 },
        },
        t
      )
    ).toBeUndefined();
  });

  it('describes a row-countable percentage threshold', () => {
    const preview = getThresholdPreview(
      {
        definition: definitionOf('columnValuesToMatchRegex'),
        params: {
          threshold: '1',
          thresholdUnit: { id: 'PERCENTAGE', label: '% of non-null values' },
        },
        target: 'email',
      },
      t
    );

    expect(preview?.sentence).toBe(
      'Fail when more than 1% of non-null values in email fail this test.'
    );
    expect(preview?.samplingNote).toBeUndefined();
  });

  it('describes an absolute row threshold and the profiling sample', () => {
    const preview = getThresholdPreview(
      {
        definition: definitionOf('columnValuesToBeNotNull'),
        params: { threshold: 50 },
        target: 'email',
        profileSample: 10,
        profileSampleType: ProfileSampleType.Percentage,
      },
      t
    );

    expect(preview?.sentence).toBe(
      'Fail when more than 50 rows in email fail this test.'
    );
    expect(preview?.samplingNote).toBe(
      'Measured on the 10% sample this table is profiled with.'
    );
  });

  it('shows the effective range of a statistical percentage deviation', () => {
    const preview = getThresholdPreview(
      {
        definition: definitionOf('columnValueMeanToBeBetween', [
          { name: 'minValueForMeanInCol' },
          { name: 'maxValueForMeanInCol' },
        ]),
        params: {
          minValueForMeanInCol: '90',
          maxValueForMeanInCol: '110',
          threshold: 5,
          thresholdUnit: { id: 'PERCENTAGE' },
        },
        target: 'amount',
      },
      t
    );

    expect(preview?.sentence).toBe(
      'Fail when the measured value falls outside 90 – 110, allowing a 5% deviation (effective range 85.5 – 115.5).'
    );
    expect(preview?.zeroBoundWarning).toBeUndefined();
  });

  it('widens both ends by the threshold when the unit is absolute', () => {
    const preview = getThresholdPreview(
      {
        definition: definitionOf('tableRowCountToBeBetween', [
          { name: 'minValue' },
          { name: 'maxValue' },
        ]),
        params: { minValue: 100, maxValue: 200, threshold: 10 },
      },
      t
    );

    expect(preview?.sentence).toBe(
      'Fail when the measured value falls outside 100 – 200, allowing a 10 units deviation (effective range 90 – 210).'
    );
  });

  it('warns when a percentage deviation is applied around a bound of zero', () => {
    const preview = getThresholdPreview(
      {
        definition: definitionOf('columnValuesMissingCountToBeEqual', [
          { name: 'missingCountValue' },
        ]),
        params: {
          missingCountValue: 0,
          threshold: 5,
          thresholdUnit: { id: 'PERCENTAGE' },
        },
      },
      t
    );

    expect(preview?.sentence).toContain('= 0');
    expect(preview?.sentence).toContain('effective range 0 – 0');
    expect(preview?.zeroBoundWarning).toBe(
      'A percentage deviation around a bound of 0 leaves that bound at 0 — use an absolute deviation instead.'
    );
  });

  it('drops the deviation clause when the threshold is zero', () => {
    const preview = getThresholdPreview(
      {
        definition: definitionOf('columnValueMeanToBeBetween', [
          { name: 'minValueForMeanInCol' },
          { name: 'maxValueForMeanInCol' },
        ]),
        params: { minValueForMeanInCol: 90 },
      },
      t
    );

    expect(preview?.sentence).toBe(
      'Fail when the measured value falls outside ≥ 90.'
    );
  });

  it('returns nothing for a statistical test with no bound yet', () => {
    expect(
      getThresholdPreview(
        {
          definition: definitionOf('columnValueMeanToBeBetween', [
            { name: 'minValueForMeanInCol' },
            { name: 'maxValueForMeanInCol' },
          ]),
          params: { threshold: 5 },
        },
        t
      )
    ).toBeUndefined();
  });

  it('reads the custom SQL query through its operator and strategy', () => {
    const rowsPreview = getThresholdPreview(
      {
        definition: definitionOf('tableCustomSQLQuery', [
          { name: 'operator', optionValues: ['<=', '>'] },
          { name: 'strategy', optionValues: ['ROWS', 'COUNT'] },
        ]),
        params: {
          operator: { id: '<=' },
          strategy: { id: 'ROWS' },
          threshold: 10,
        },
      },
      t
    );

    expect(rowsPreview?.sentence).toBe(
      'Pass when the query returns at most 10 rows.'
    );

    const countPreview = getThresholdPreview(
      {
        definition: definitionOf('tableCustomSQLQuery', [
          { name: 'operator', optionValues: ['<=', '>'] },
          { name: 'strategy', optionValues: ['ROWS', 'COUNT'] },
        ]),
        params: {
          operator: { id: '>' },
          strategy: { id: 'COUNT' },
          threshold: 1,
        },
      },
      t
    );

    expect(countPreview?.sentence).toBe(
      'Pass when the number the query returns is more than 1.'
    );
  });
});

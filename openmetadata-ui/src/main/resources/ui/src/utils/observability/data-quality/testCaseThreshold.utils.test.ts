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

import {
  ProfileSampleType,
  SampleConfigType,
  TableProfilerConfig,
} from '../../../generated/entity/data/table';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import {
  CustomSqlStrategy,
  getParamOptionLabelKey,
  getThresholdNoun,
  getThresholdPreviewData,
  getThresholdSampling,
  getThresholdTestSemantic,
  getThresholdUnitLabelParts,
  hasThresholdUnitParam,
  ThresholdNoun,
  ThresholdSamplingKind,
  ThresholdTestSemantic,
} from './testCaseThreshold.utils';

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
    // The 12 tests migrated to the deviation-from-statistic semantic. The
    // definition name is not always the seed file stem — the missing-count
    // test is declared in `columnValuesMissingCountToBeEqual.json`.
    ['columnValueMaxToBeBetween', ThresholdTestSemantic.Statistical],
    ['columnValueMeanToBeBetween', ThresholdTestSemantic.Statistical],
    ['columnValuesMissingCount', ThresholdTestSemantic.Statistical],
    ['tableRowCountToEqual', ThresholdTestSemantic.Statistical],
    ['tableRowInsertedCountToBeBetween', ThresholdTestSemantic.Statistical],
    // The 6 validators that call `_apply_row_threshold`.
    ['columnValuesToMatchRegex', ThresholdTestSemantic.RowCountable],
    ['columnValuesToBeNotNull', ThresholdTestSemantic.RowCountable],
    ['columnValuesToBeUnique', ThresholdTestSemantic.RowCountable],
    ['tableCustomSQLQuery', ThresholdTestSemantic.CustomSql],
    // Declares the threshold params, but no validator reads them yet.
    ['columnValuesToBeBetween', ThresholdTestSemantic.NotEnforced],
    ['columnValueLengthsToBeBetween', ThresholdTestSemantic.NotEnforced],
    ['columnValuesToBeAtExpectedLocation', ThresholdTestSemantic.NotEnforced],
  ])('classifies %s as %s', (name, expected) => {
    expect(getThresholdTestSemantic(name)).toBe(expected);
  });
});

describe('getThresholdNoun', () => {
  it.each([
    // Per-test denominators, mirroring the metric each validator passes to
    // `_apply_row_threshold`: `valuesCount` (non-null) or `rowCount` (all).
    ['columnValuesToMatchRegex', 'PERCENTAGE', ThresholdNoun.NonNullValues],
    ['columnValuesToBeUnique', 'PERCENTAGE', ThresholdNoun.NonNullValues],
    ['columnValuesToBeNotNull', 'PERCENTAGE', ThresholdNoun.Rows],
    ['columnValuesToNotMatchRegex', 'PERCENTAGE', ThresholdNoun.Rows],
    ['columnValuesToBeNotInSet', 'PERCENTAGE', ThresholdNoun.Rows],
    ['columnValuesToBeInSet', 'PERCENTAGE', ThresholdNoun.Rows],
    ['columnValuesToMatchRegex', 'ABSOLUTE', ThresholdNoun.Rows],
    ['columnValueMeanToBeBetween', 'ABSOLUTE', ThresholdNoun.Units],
    ['columnValueMeanToBeBetween', 'PERCENTAGE', ThresholdNoun.Bound],
    ['tableCustomSQLQuery', 'ABSOLUTE', ThresholdNoun.Rows],
    ['tableCustomSQLQuery', 'PERCENTAGE', ThresholdNoun.TableRows],
  ])('resolves %s + %s to %s', (name, unit, expected) => {
    expect(getThresholdNoun(unit, name)).toBe(expected);
  });
});

describe('getThresholdUnitLabelParts', () => {
  it('returns the noun key and whether it is a share', () => {
    expect(
      getThresholdUnitLabelParts('PERCENTAGE', 'columnValuesToMatchRegex')
    ).toEqual({
      nounKey: 'label.threshold-noun-non-null-values',
      isPercentage: true,
    });

    expect(
      getThresholdUnitLabelParts('ABSOLUTE', 'columnValueMeanToBeBetween')
    ).toEqual({
      nounKey: 'label.threshold-noun-units',
      isPercentage: false,
    });
  });

  it('has no sentence for a unit it does not know', () => {
    expect(
      getThresholdUnitLabelParts('FURLONGS', 'columnValuesToBeUnique')
    ).toBeUndefined();
  });
});

describe('getParamOptionLabelKey', () => {
  it.each([
    ['<=', 'label.threshold-operator-at-most'],
    ['<', 'label.threshold-operator-fewer-than'],
    ['>=', 'label.threshold-operator-at-least'],
    ['>', 'label.threshold-operator-more-than'],
    ['==', 'label.threshold-operator-exactly'],
    ['!=', 'label.threshold-operator-anything-other-than'],
  ])('keys the custom SQL operator %s', (optionValue, expected) => {
    expect(
      getParamOptionLabelKey('tableCustomSQLQuery', 'operator', optionValue)
    ).toBe(expected);
  });

  it('keys strategy and dimension failure policy', () => {
    expect(
      getParamOptionLabelKey('tableCustomSQLQuery', 'strategy', 'ROWS')
    ).toBe('label.custom-sql-strategy-rows');
    expect(
      getParamOptionLabelKey('tableCustomSQLQuery', 'strategy', 'COUNT')
    ).toBe('label.custom-sql-strategy-count');
    expect(
      getParamOptionLabelKey(
        'columnValuesToBeNotNull',
        'dimensionFailurePolicy',
        'ANY_DIMENSION'
      )
    ).toBe('label.dimension-failure-policy-any-dimension');
  });

  it('has no key for enums with no sentence', () => {
    expect(
      getParamOptionLabelKey(
        'tableRowInsertedCountToBeBetween',
        'rangeType',
        'HOUR'
      )
    ).toBeUndefined();
  });

  it('does not borrow the custom SQL operator wording for other tests', () => {
    expect(
      getParamOptionLabelKey('someOtherTest', 'operator', '<=')
    ).toBeUndefined();
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

describe('getThresholdSampling', () => {
  it('reads a static percentage sample from the nested config', () => {
    // The shape GET /tables/{id}/tableProfilerConfig actually returns: the
    // sample lives under `profileSampleConfig.config`, not on the config root.
    const profilerConfig = {
      profileSampleConfig: {
        sampleConfigType: SampleConfigType.Static,
        config: {
          profileSample: 10,
          profileSampleType: ProfileSampleType.Percentage,
        },
      },
    } as TableProfilerConfig;

    expect(getThresholdSampling(profilerConfig)).toEqual({
      kind: ThresholdSamplingKind.StaticPercentage,
      value: 10,
    });
  });

  it('reads a static row sample', () => {
    expect(
      getThresholdSampling({
        profileSampleConfig: {
          config: {
            profileSample: 500,
            profileSampleType: ProfileSampleType.Rows,
          },
        },
      } as TableProfilerConfig)
    ).toEqual({ kind: ThresholdSamplingKind.StaticRows, value: 500 });
  });

  it.each([
    [
      'the config type is dynamic',
      {
        sampleConfigType: SampleConfigType.Dynamic,
        config: {
          thresholds: [{ profileSample: 10, rowCountThreshold: 1000 }],
        },
      },
    ],
    ['smart sampling is on', { config: { smartSampling: true } }],
  ])('reports a dynamically sized sample when %s', (_, sampleConfig) => {
    expect(
      getThresholdSampling({
        profileSampleConfig: sampleConfig,
      } as TableProfilerConfig)
    ).toEqual({ kind: ThresholdSamplingKind.Dynamic });
  });

  it.each([
    ['there is no profiler config', undefined],
    ['the table is not sampled', {} as TableProfilerConfig],
    [
      'a static config has no sample',
      { profileSampleConfig: { config: {} } } as TableProfilerConfig,
    ],
  ])('has nothing to say when %s', (_, profilerConfig) => {
    expect(getThresholdSampling(profilerConfig)).toBeUndefined();
  });
});

describe('getThresholdPreviewData', () => {
  it('returns nothing for a definition without a threshold unit', () => {
    expect(
      getThresholdPreviewData({
        definition: {
          name: 'tableDiff',
          parameterDefinition: [{ name: 'threshold' }],
        } as TestDefinition,
        params: { threshold: 5 },
      })
    ).toBeUndefined();
  });

  it('describes a row-countable percentage threshold against non-null values', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('columnValuesToMatchRegex'),
      params: {
        threshold: '1',
        thresholdUnit: { id: 'PERCENTAGE', label: '% of non-null values' },
      },
      target: 'email',
    });

    expect(data).toMatchObject({
      semantic: ThresholdTestSemantic.RowCountable,
      threshold: 1,
      isPercentage: true,
      noun: ThresholdNoun.NonNullValues,
      target: 'email',
      isThresholdIgnored: false,
      isUnitIgnored: false,
    });
    expect(data?.sampling).toBeUndefined();
  });

  it('carries the sampling of the table the threshold is measured on', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('columnValuesToBeNotNull'),
      params: { threshold: 50 },
      target: 'email',
      profilerConfig: {
        profileSampleConfig: {
          config: {
            profileSample: 10,
            profileSampleType: ProfileSampleType.Percentage,
          },
        },
      } as TableProfilerConfig,
    });

    expect(data?.noun).toBe(ThresholdNoun.Rows);
    expect(data?.sampling).toEqual({
      kind: ThresholdSamplingKind.StaticPercentage,
      value: 10,
    });
  });

  it('computes the effective range of a statistical percentage deviation', () => {
    const data = getThresholdPreviewData({
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
    });

    expect(data).toMatchObject({
      semantic: ThresholdTestSemantic.Statistical,
      bound: '90 – 110',
      effectiveRange: '85.5 – 115.5',
      hasZeroBound: false,
    });
  });

  it('widens both ends by the threshold when the unit is absolute', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('tableRowCountToBeBetween', [
        { name: 'minValue' },
        { name: 'maxValue' },
      ]),
      params: { minValue: 100, maxValue: 200, threshold: 10 },
    });

    expect(data?.bound).toBe('100 – 200');
    expect(data?.effectiveRange).toBe('90 – 210');
  });

  it('widens a negative bound outward, as apply_bound_tolerance does', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('columnValueMinToBeBetween', [
        { name: 'minValueForMinInCol' },
        { name: 'maxValueForMinInCol' },
      ]),
      params: {
        minValueForMinInCol: -100,
        maxValueForMinInCol: -10,
        threshold: 5,
        thresholdUnit: { id: 'PERCENTAGE' },
      },
    });

    expect(data?.effectiveRange).toBe('-105 – -9.5');
  });

  it('keeps small bounds meaningful instead of rounding them to zero', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('columnValueMeanToBeBetween', [
        { name: 'minValueForMeanInCol' },
        { name: 'maxValueForMeanInCol' },
      ]),
      params: {
        minValueForMeanInCol: 0.00000001,
        maxValueForMeanInCol: 0.00000002,
        threshold: 5,
        thresholdUnit: { id: 'PERCENTAGE' },
      },
    });

    expect(data?.effectiveRange).toBe('9.5e-9 – 2.1e-8');
  });

  it('trims the float noise a percentage leaves behind', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('tableRowCountToBeBetween', [
        { name: 'minValue' },
        { name: 'maxValue' },
      ]),
      params: {
        minValue: 90,
        maxValue: 110,
        threshold: 5,
        thresholdUnit: { id: 'PERCENTAGE' },
      },
    });

    // 110 * 1.05 is 115.50000000000001 in binary floating point.
    expect(data?.effectiveRange).toBe('85.5 – 115.5');
  });

  it('reads the missing-count test as an equality with a tolerated delta', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('columnValuesMissingCount', [
        { name: 'missingCountValue' },
      ]),
      params: { missingCountValue: 10, threshold: 2 },
    });

    expect(data).toMatchObject({
      semantic: ThresholdTestSemantic.Statistical,
      noun: ThresholdNoun.Units,
      bound: '= 10',
      effectiveRange: '8 – 12',
    });
  });

  it('flags a percentage deviation applied around a bound of zero', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('columnValuesMissingCount', [
        { name: 'missingCountValue' },
      ]),
      params: {
        missingCountValue: 0,
        threshold: 5,
        thresholdUnit: { id: 'PERCENTAGE' },
      },
    });

    expect(data?.bound).toBe('= 0');
    expect(data?.effectiveRange).toBe('0 – 0');
    expect(data?.hasZeroBound).toBe(true);
  });

  it('has no effective range when the threshold is zero', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('columnValueMeanToBeBetween', [
        { name: 'minValueForMeanInCol' },
        { name: 'maxValueForMeanInCol' },
      ]),
      params: { minValueForMeanInCol: 90 },
    });

    expect(data?.bound).toBe('≥ 90');
    expect(data?.effectiveRange).toBeUndefined();
  });

  it('returns nothing for a statistical test with no bound yet', () => {
    expect(
      getThresholdPreviewData({
        definition: definitionOf('columnValueMeanToBeBetween', [
          { name: 'minValueForMeanInCol' },
          { name: 'maxValueForMeanInCol' },
        ]),
        params: { threshold: 5 },
      })
    ).toBeUndefined();
  });

  it('reads the custom SQL query through its operator and strategy', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('tableCustomSQLQuery', [
        { name: 'operator', optionValues: ['<=', '>'] },
        { name: 'strategy', optionValues: ['ROWS', 'COUNT'] },
      ]),
      params: {
        operator: { id: '<=' },
        strategy: { id: 'ROWS' },
        threshold: 10,
      },
    });

    expect(data).toMatchObject({
      semantic: ThresholdTestSemantic.CustomSql,
      operator: '<=',
      operatorLabelKey: 'label.threshold-operator-at-most',
      strategy: CustomSqlStrategy.Rows,
      isUnitIgnored: false,
    });
  });

  it('flags that custom SQL ignores a percentage unit', () => {
    // `evaluate_threshold` compares the raw row count, so a PERCENTAGE unit
    // changes nothing about the verdict.
    const data = getThresholdPreviewData({
      definition: definitionOf('tableCustomSQLQuery', [
        { name: 'operator', optionValues: ['<=', '>'] },
      ]),
      params: {
        operator: { id: '>' },
        threshold: 1,
        thresholdUnit: { id: 'PERCENTAGE' },
      },
    });

    expect(data?.isUnitIgnored).toBe(true);
    expect(data?.isThresholdIgnored).toBe(false);
  });

  it('flags a test whose threshold no validator reads yet', () => {
    const data = getThresholdPreviewData({
      definition: definitionOf('columnValuesToBeBetween', [
        { name: 'minValue' },
        { name: 'maxValue' },
      ]),
      params: { minValue: 1, maxValue: 10, threshold: 5 },
    });

    expect(data).toMatchObject({
      semantic: ThresholdTestSemantic.NotEnforced,
      isThresholdIgnored: true,
    });
    expect(data?.effectiveRange).toBeUndefined();
  });
});

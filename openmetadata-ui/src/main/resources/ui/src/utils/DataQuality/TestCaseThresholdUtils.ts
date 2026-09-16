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

import { FormSelectItem } from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { ProfileSampleType } from '../../generated/entity/data/table';
import {
  TestCaseParameterDefinition,
  TestDefinition,
} from '../../generated/tests/testDefinition';
import { unwrapSelectValue } from '../ParameterForm/ParameterFieldsUtils';

export const THRESHOLD_PARAM = 'threshold';
export const THRESHOLD_UNIT_PARAM = 'thresholdUnit';
const OPERATOR_PARAM = 'operator';
const STRATEGY_PARAM = 'strategy';
const DIMENSION_FAILURE_POLICY_PARAM = 'dimensionFailurePolicy';

const TABLE_CUSTOM_SQL_QUERY = 'tableCustomSQLQuery';

export enum ThresholdUnit {
  Absolute = 'ABSOLUTE',
  Percentage = 'PERCENTAGE',
}

export enum CustomSqlStrategy {
  Rows = 'ROWS',
  Count = 'COUNT',
}

/**
 * How a test reads its `threshold`, which is what decides the noun the unit
 * dropdown shows and the shape of the preview sentence.
 *
 * - `ROW_COUNTABLE` — the threshold tolerates failing rows of a per-row
 *   predicate (regex, not-null, in-set, ...).
 * - `STATISTICAL` — the test asserts an aggregate against a bound, so the
 *   threshold widens that bound instead of counting rows.
 * - `CUSTOM_SQL` — `tableCustomSQLQuery`, whose `threshold` is the expected
 *   result compared through its own `operator`, not a failure tolerance.
 */
export enum ThresholdTestSemantic {
  RowCountable = 'ROW_COUNTABLE',
  Statistical = 'STATISTICAL',
  CustomSql = 'CUSTOM_SQL',
}

interface BoundParamNames {
  min: string;
  max: string;
}

/**
 * The bound params of every statistical (aggregate-vs-bound) test, keyed by
 * test definition name. Membership in this map *is* the statistical
 * classification — `supportsRowLevelPassedFailed` cannot be used for it
 * (`columnValuesToBeBetween` is bound-shaped yet counts rows, and
 * `columnValueToBeAtExpectedLocation` counts rows yet declares the flag
 * false) — and the entries are needed anyway to compute the effective range
 * the preview shows.
 *
 * Equality tests (`...ToEqual`, `...ToBeEqual`) name the same param twice:
 * their bound is the single expected value.
 */
const STATISTICAL_BOUND_PARAMS: Record<string, BoundParamNames> = {
  columnValueMaxToBeBetween: {
    min: 'minValueForMaxInCol',
    max: 'maxValueForMaxInCol',
  },
  columnValueMeanToBeBetween: {
    min: 'minValueForMeanInCol',
    max: 'maxValueForMeanInCol',
  },
  columnValueMedianToBeBetween: {
    min: 'minValueForMedianInCol',
    max: 'maxValueForMedianInCol',
  },
  columnValueMinToBeBetween: {
    min: 'minValueForMinInCol',
    max: 'maxValueForMinInCol',
  },
  columnValueStdDevToBeBetween: {
    min: 'minValueForStdDevInCol',
    max: 'maxValueForStdDevInCol',
  },
  columnValuesSumToBeBetween: {
    min: 'minValueForColSum',
    max: 'maxValueForColSum',
  },
  columnValuesMissingCountToBeEqual: {
    min: 'missingCountValue',
    max: 'missingCountValue',
  },
  tableColumnCountToBeBetween: { min: 'minColValue', max: 'maxColValue' },
  tableColumnCountToEqual: { min: 'columnCount', max: 'columnCount' },
  tableRowCountToBeBetween: { min: 'minValue', max: 'maxValue' },
  tableRowCountToEqual: { min: 'value', max: 'value' },
  tableRowInsertedCountToBeBetween: { min: 'min', max: 'max' },
};

/**
 * Row-countable tests whose denominator is every row rather than the column's
 * non-null values. Only the null check evaluates NULLs — every other per-row
 * predicate (regex, set membership, range, uniqueness) skips them, so a
 * percentage there is read against the non-null values.
 */
const ALL_ROWS_DENOMINATOR_TESTS = new Set(['columnValuesToBeNotNull']);

const OPERATOR_LABEL_KEYS: Record<string, string> = {
  '<=': 'label.threshold-operator-at-most',
  '<': 'label.threshold-operator-fewer-than',
  '>=': 'label.threshold-operator-at-least',
  '>': 'label.threshold-operator-more-than',
  '==': 'label.threshold-operator-exactly',
  '!=': 'label.threshold-operator-anything-other-than',
};

const STRATEGY_LABEL_KEYS: Record<string, string> = {
  [CustomSqlStrategy.Rows]: 'label.custom-sql-strategy-rows',
  [CustomSqlStrategy.Count]: 'label.custom-sql-strategy-count',
};

const DIMENSION_FAILURE_POLICY_LABEL_KEYS: Record<string, string> = {
  OVERALL_ONLY: 'label.dimension-failure-policy-overall-only',
  ANY_DIMENSION: 'label.dimension-failure-policy-any-dimension',
};

export const getThresholdTestSemantic = (
  definitionName: string | undefined
): ThresholdTestSemantic => {
  let result = ThresholdTestSemantic.RowCountable;
  if (definitionName === TABLE_CUSTOM_SQL_QUERY) {
    result = ThresholdTestSemantic.CustomSql;
  } else if (definitionName && STATISTICAL_BOUND_PARAMS[definitionName]) {
    result = ThresholdTestSemantic.Statistical;
  }

  return result;
};

/**
 * What the threshold is counted in. It is contextual — "10 rows", "10 units"
 * and "10% of the bound" are the same stored `ABSOLUTE`/`PERCENTAGE` id under
 * three different test classes — so it must be resolved from
 * `(unit, testDefinitionName)` and never from a flat map.
 */
const getThresholdNoun = (
  unit: string,
  definitionName: string | undefined,
  t: TFunction
): string => {
  const semantic = getThresholdTestSemantic(definitionName);

  if (semantic === ThresholdTestSemantic.Statistical) {
    return unit === ThresholdUnit.Percentage
      ? t('label.threshold-noun-the-bound')
      : t('label.threshold-noun-units');
  }

  if (semantic === ThresholdTestSemantic.CustomSql) {
    return unit === ThresholdUnit.Percentage
      ? t('label.threshold-noun-table-rows')
      : t('label.threshold-noun-rows');
  }

  const isNonNullDenominator =
    unit === ThresholdUnit.Percentage &&
    !(definitionName && ALL_ROWS_DENOMINATOR_TESTS.has(definitionName));

  return isNonNullDenominator
    ? t('label.threshold-noun-non-null-values')
    : t('label.threshold-noun-rows');
};

/** The sentence the `thresholdUnit` dropdown shows for one stored id. */
export const getThresholdUnitLabel = (
  unit: string,
  definitionName: string | undefined,
  t: TFunction
): string => {
  if (unit === ThresholdUnit.Percentage) {
    return t('label.threshold-unit-percentage', {
      noun: getThresholdNoun(unit, definitionName, t),
    });
  }

  // An id the backend added after this mapping — show it as stored rather
  // than inventing a sentence for it.
  return unit === ThresholdUnit.Absolute
    ? getThresholdNoun(unit, definitionName, t)
    : unit;
};

/**
 * Sentence label for one `optionValues` entry. The returned label is display
 * only — the `FormSelectItem.id` stays the raw enum the backend stores, so no
 * stored value changes and existing test cases pick the new wording up.
 */
export const getParamOptionLabel = (
  definitionName: string | undefined,
  paramName: string | undefined,
  optionValue: string,
  t: TFunction
): string => {
  const isCustomSqlQuery = definitionName === TABLE_CUSTOM_SQL_QUERY;
  let labelKey: string | undefined;

  if (paramName === THRESHOLD_UNIT_PARAM) {
    return getThresholdUnitLabel(optionValue, definitionName, t);
  }

  if (paramName === OPERATOR_PARAM && isCustomSqlQuery) {
    labelKey = OPERATOR_LABEL_KEYS[optionValue];
  } else if (paramName === STRATEGY_PARAM && isCustomSqlQuery) {
    labelKey = STRATEGY_LABEL_KEYS[optionValue];
  } else if (paramName === DIMENSION_FAILURE_POLICY_PARAM) {
    labelKey = DIMENSION_FAILURE_POLICY_LABEL_KEYS[optionValue];
  }

  return labelKey ? t(labelKey) : optionValue;
};

export const getParamSelectOptions = (
  definitionName: string | undefined,
  param: TestCaseParameterDefinition,
  t: TFunction
): FormSelectItem[] =>
  (param.optionValues ?? []).map((optionValue) => ({
    id: optionValue as string,
    label: getParamOptionLabel(
      definitionName,
      param.name,
      optionValue as string,
      t
    ),
  }));

export const hasThresholdUnitParam = (
  definition: TestDefinition | undefined
): boolean =>
  Boolean(
    definition?.parameterDefinition?.some(
      (param) => param.name === THRESHOLD_UNIT_PARAM
    )
  );

// ─── Live preview ────────────────────────────────────────────────────────────

/** Trims the float noise `bound * (1 + pct)` leaves behind (110 * 1.05). */
const roundValue = (value: number): number => Math.round(value * 1e6) / 1e6;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

/**
 * Renders a min/max pair the way users read it: an interval when both ends are
 * set, a single-sided comparison when only one is, and an equality when both
 * name the same value (the `...ToEqual` family).
 */
const formatBound = (
  min: number | undefined,
  max: number | undefined
): string | undefined => {
  if (min !== undefined && max !== undefined) {
    return min === max ? `= ${min}` : `${min} – ${max}`;
  }
  if (min !== undefined) {
    return `≥ ${min}`;
  }
  if (max !== undefined) {
    return `≤ ${max}`;
  }

  return undefined;
};

/**
 * The bound after `threshold` is applied — an absolute threshold widens each
 * end by that many units, a percentage one by that share of the end itself.
 * This is the number users actually reason about, and computing it is what
 * makes the zero-bound degenerate case visible.
 */
const getEffectiveBound = (
  bound: number,
  threshold: number,
  unit: string,
  direction: -1 | 1
): number => {
  const delta =
    unit === ThresholdUnit.Percentage
      ? Math.abs(bound) * (threshold / 100)
      : threshold;

  return roundValue(bound + direction * delta);
};

export interface ThresholdPreviewInput {
  definition: TestDefinition;
  /** Raw react-hook-form `params` values — selects are `FormSelectItem`s. */
  params: Record<string, unknown>;
  /** Column name for column-level tests, table name for table-level ones. */
  target?: string;
  profileSample?: number;
  profileSampleType?: ProfileSampleType;
}

export interface ThresholdPreview {
  sentence: string;
  /** Present when the table is profiled on a sample, which the test inherits. */
  samplingNote?: string;
  /** Present when a percentage deviation is applied around a bound of 0. */
  zeroBoundWarning?: string;
}

const formatAmount = (
  threshold: number,
  unit: string,
  definitionName: string | undefined,
  t: TFunction
): string => {
  const noun = getThresholdNoun(unit, definitionName, t);

  return unit === ThresholdUnit.Percentage
    ? t('message.threshold-amount-percentage', { value: threshold, noun })
    : t('message.threshold-amount-absolute', { value: threshold, noun });
};

const getSamplingNote = (
  input: ThresholdPreviewInput,
  t: TFunction
): string | undefined => {
  const { profileSample, profileSampleType } = input;
  if (profileSample === undefined) {
    return undefined;
  }

  const sample =
    profileSampleType === ProfileSampleType.Rows
      ? t('message.threshold-amount-absolute', {
          value: profileSample,
          noun: t('label.threshold-noun-rows'),
        })
      : t('label.percentage-value', { value: profileSample });

  return t('message.dq-threshold-preview-sampling', { sample });
};

const getRowCountableSentence = (
  input: ThresholdPreviewInput,
  threshold: number,
  unit: string,
  t: TFunction
): string =>
  t('message.dq-threshold-preview-row-countable', {
    amount: formatAmount(threshold, unit, input.definition.name, t),
    target: input.target ?? t('label.column-lowercase'),
  });

const getCustomSqlSentence = (
  input: ThresholdPreviewInput,
  threshold: number,
  unit: string,
  t: TFunction
): string => {
  const { params, definition } = input;
  const strategy =
    unwrapSelectValue(params[STRATEGY_PARAM]) ?? CustomSqlStrategy.Rows;
  const operator = unwrapSelectValue(params[OPERATOR_PARAM]) ?? '<=';
  const operatorLabel = getParamOptionLabel(
    definition.name,
    OPERATOR_PARAM,
    operator,
    t
  );

  return strategy === CustomSqlStrategy.Count
    ? t('message.dq-threshold-preview-custom-sql-count', {
        operator: operatorLabel,
        value: threshold,
      })
    : t('message.dq-threshold-preview-custom-sql-rows', {
        operator: operatorLabel,
        amount: formatAmount(threshold, unit, definition.name, t),
      });
};

const getStatisticalPreview = (
  input: ThresholdPreviewInput,
  threshold: number,
  unit: string,
  t: TFunction
): Pick<ThresholdPreview, 'sentence' | 'zeroBoundWarning'> | undefined => {
  const { definition, params } = input;
  const bounds = STATISTICAL_BOUND_PARAMS[definition.name ?? ''];
  const min = toNumber(params[bounds.min]);
  const max = toNumber(params[bounds.max]);
  const bound = formatBound(min, max);

  // Nothing to preview until at least one bound is filled in — the sentence
  // would otherwise read "falls outside nothing".
  if (!bound) {
    return undefined;
  }

  if (threshold <= 0) {
    return {
      sentence: t('message.dq-threshold-preview-statistical', { bound }),
    };
  }

  const effectiveMin =
    min === undefined ? undefined : getEffectiveBound(min, threshold, unit, -1);
  const effectiveMax =
    max === undefined ? undefined : getEffectiveBound(max, threshold, unit, 1);
  const range =
    effectiveMin !== undefined && effectiveMax !== undefined
      ? `${effectiveMin} – ${effectiveMax}`
      : (formatBound(effectiveMin, effectiveMax) as string);

  const isZeroBound =
    unit === ThresholdUnit.Percentage && (min === 0 || max === 0);

  // The bound the deviation is measured against is already in the sentence, so
  // the clause reads "a 5% deviation", not "a 5% of the bound deviation".
  const amount =
    unit === ThresholdUnit.Percentage
      ? t('label.percentage-value', { value: threshold })
      : formatAmount(threshold, unit, definition.name, t);

  return {
    sentence: t('message.dq-threshold-preview-statistical-deviation', {
      bound,
      amount,
      range,
    }),
    zeroBoundWarning: isZeroBound
      ? t('message.dq-threshold-preview-zero-bound')
      : undefined,
  };
};

/**
 * Builds the live preview of what the configured threshold actually does.
 * Returns `undefined` when the selected test has no `thresholdUnit` param, or
 * when a statistical test has no bound yet — in both cases there is nothing
 * truthful to say.
 */
export const getThresholdPreview = (
  input: ThresholdPreviewInput,
  t: TFunction
): ThresholdPreview | undefined => {
  const { definition, params } = input;
  if (!hasThresholdUnitParam(definition)) {
    return undefined;
  }

  const threshold = toNumber(params[THRESHOLD_PARAM]) ?? 0;
  const unit =
    unwrapSelectValue(params[THRESHOLD_UNIT_PARAM]) ?? ThresholdUnit.Absolute;
  const semantic = getThresholdTestSemantic(definition.name);
  const samplingNote = getSamplingNote(input, t);

  if (semantic === ThresholdTestSemantic.Statistical) {
    const preview = getStatisticalPreview(input, threshold, unit, t);

    return preview ? { ...preview, samplingNote } : undefined;
  }

  const sentence =
    semantic === ThresholdTestSemantic.CustomSql
      ? getCustomSqlSentence(input, threshold, unit, t)
      : getRowCountableSentence(input, threshold, unit, t);

  return { sentence, samplingNote };
};

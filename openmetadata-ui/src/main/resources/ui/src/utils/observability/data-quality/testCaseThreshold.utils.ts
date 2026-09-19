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
import { unwrapSelectValue } from '../../ParameterForm/ParameterFieldsUtils';

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
 * How a test reads its `threshold`, which decides the noun the unit dropdown
 * shows and the shape of the preview sentence. Every member mirrors a
 * threshold reader that exists in ingestion today — see the registries below.
 *
 * - `ROW_COUNTABLE` — the threshold tolerates failing rows of a per-row
 *   predicate (regex, not-null, in-set, ...), via `_apply_row_threshold`.
 * - `STATISTICAL` — the test asserts an aggregate against a bound, so the
 *   threshold widens that bound instead of counting rows, via
 *   `apply_bound_tolerance` / `within_deviation`.
 * - `CUSTOM_SQL` — `tableCustomSQLQuery`, whose `threshold` is the expected
 *   result compared through its own `operator`, not a failure tolerance.
 * - `NOT_ENFORCED` — the test definition declares the threshold parameters but
 *   no validator reads them yet, so nothing may be promised about them.
 */
export enum ThresholdTestSemantic {
  RowCountable = 'ROW_COUNTABLE',
  Statistical = 'STATISTICAL',
  CustomSql = 'CUSTOM_SQL',
  NotEnforced = 'NOT_ENFORCED',
}

/** What a threshold is counted in, resolved from `(unit, test definition)`. */
export enum ThresholdNoun {
  Rows = 'ROWS',
  NonNullValues = 'NON_NULL_VALUES',
  TableRows = 'TABLE_ROWS',
  Units = 'UNITS',
  Bound = 'BOUND',
}

/** How the profiler samples the table the threshold is measured on. */
export enum ThresholdSamplingKind {
  StaticPercentage = 'STATIC_PERCENTAGE',
  StaticRows = 'STATIC_ROWS',
  Dynamic = 'DYNAMIC',
}

interface BoundParamNames {
  min: string;
  max: string;
}

/**
 * The bound params of every statistical test, keyed by test definition name.
 * Membership in this map *is* the statistical classification — it is the UI
 * mirror of the validators that call `get_bounds()`/`matches_expected()`, and
 * `supportsRowLevelPassedFailed` cannot stand in for it
 * (`columnValuesToBeBetween` is bound-shaped yet declares the flag true, and
 * `columnValuesToBeAtExpectedLocation` counts rows yet declares it false).
 * The entries are needed anyway to compute the effective range the preview
 * shows.
 *
 * Keys are test definition `name`s, which are *not* always the seed file stem:
 * `columnValuesMissingCountToBeEqual.json` declares
 * `name: "columnValuesMissingCount"`.
 *
 * Equality tests (`...ToEqual`, missing-count) name the same param twice:
 * their bound is the single expected value, and a deviation is tolerated on
 * both sides of it.
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
  columnValuesMissingCount: {
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
 * The denominator a PERCENTAGE threshold is read against, per row-countable
 * test. Membership *is* the row-countable classification: these six are the
 * validators that call `_apply_row_threshold`, and the value is the metric
 * they pass as its denominator — `valuesCount` (the column's non-null values)
 * or `rowCount` (every row). Getting this wrong misnames the very quantity the
 * user is budgeting, so it is mirrored per test rather than guessed from the
 * predicate.
 */
const ROW_COUNTABLE_DENOMINATORS: Record<string, ThresholdNoun> = {
  columnValuesToMatchRegex: ThresholdNoun.NonNullValues,
  columnValuesToBeUnique: ThresholdNoun.NonNullValues,
  columnValuesToBeInSet: ThresholdNoun.Rows,
  columnValuesToBeNotInSet: ThresholdNoun.Rows,
  columnValuesToBeNotNull: ThresholdNoun.Rows,
  columnValuesToNotMatchRegex: ThresholdNoun.Rows,
};

export const THRESHOLD_NOUN_KEYS: Record<ThresholdNoun, string> = {
  [ThresholdNoun.Rows]: 'label.threshold-noun-rows',
  [ThresholdNoun.NonNullValues]: 'label.threshold-noun-non-null-values',
  [ThresholdNoun.TableRows]: 'label.threshold-noun-table-rows',
  [ThresholdNoun.Units]: 'label.threshold-noun-units',
  [ThresholdNoun.Bound]: 'label.threshold-noun-the-bound',
};

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
  let result = ThresholdTestSemantic.NotEnforced;
  if (definitionName === TABLE_CUSTOM_SQL_QUERY) {
    result = ThresholdTestSemantic.CustomSql;
  } else if (definitionName && STATISTICAL_BOUND_PARAMS[definitionName]) {
    result = ThresholdTestSemantic.Statistical;
  } else if (definitionName && ROW_COUNTABLE_DENOMINATORS[definitionName]) {
    result = ThresholdTestSemantic.RowCountable;
  }

  return result;
};

/**
 * What the threshold is counted in. It is contextual — "10 rows", "10 units"
 * and "10% of the bound" are the same stored `ABSOLUTE`/`PERCENTAGE` id under
 * three different test classes — so it is resolved from
 * `(unit, testDefinitionName)` and never from a flat map.
 */
export const getThresholdNoun = (
  unit: string,
  definitionName: string | undefined
): ThresholdNoun => {
  const isPercentage = unit === ThresholdUnit.Percentage;

  switch (getThresholdTestSemantic(definitionName)) {
    case ThresholdTestSemantic.Statistical:
      return isPercentage ? ThresholdNoun.Bound : ThresholdNoun.Units;

    case ThresholdTestSemantic.CustomSql:
      return isPercentage ? ThresholdNoun.TableRows : ThresholdNoun.Rows;

    case ThresholdTestSemantic.RowCountable:
      return isPercentage
        ? ROW_COUNTABLE_DENOMINATORS[definitionName as string]
        : ThresholdNoun.Rows;

    default:
      return ThresholdNoun.Rows;
  }
};

/**
 * The pieces of the sentence the `thresholdUnit` dropdown shows for one stored
 * id, as translation keys — the caller composes and translates them. Returns
 * `undefined` for an id this mapping does not know (one the backend added
 * later), so the caller can show it as stored rather than invent a sentence.
 */
export const getThresholdUnitLabelParts = (
  unit: string,
  definitionName: string | undefined
): { nounKey: string; isPercentage: boolean } | undefined => {
  if (unit !== ThresholdUnit.Absolute && unit !== ThresholdUnit.Percentage) {
    return undefined;
  }

  return {
    nounKey: THRESHOLD_NOUN_KEYS[getThresholdNoun(unit, definitionName)],
    isPercentage: unit === ThresholdUnit.Percentage,
  };
};

/**
 * Translation key for one `optionValues` entry, or `undefined` when the enum
 * has no sentence and should be shown as stored. `thresholdUnit` is not
 * handled here because its label is composed from two keys — use
 * `getThresholdUnitLabelParts`.
 *
 * Only the label is affected: the `FormSelectItem.id` stays the raw enum the
 * backend stores, so no stored value changes and existing test cases pick the
 * new wording up.
 */
export const getParamOptionLabelKey = (
  definitionName: string | undefined,
  paramName: string | undefined,
  optionValue: string
): string | undefined => {
  const isCustomSqlQuery = definitionName === TABLE_CUSTOM_SQL_QUERY;

  if (paramName === OPERATOR_PARAM && isCustomSqlQuery) {
    return OPERATOR_LABEL_KEYS[optionValue];
  }
  if (paramName === STRATEGY_PARAM && isCustomSqlQuery) {
    return STRATEGY_LABEL_KEYS[optionValue];
  }
  if (paramName === DIMENSION_FAILURE_POLICY_PARAM) {
    return DIMENSION_FAILURE_POLICY_LABEL_KEYS[optionValue];
  }

  return undefined;
};

export const hasThresholdUnitParam = (
  definition: TestDefinition | undefined
): boolean =>
  Boolean(
    definition?.parameterDefinition?.some(
      (param) => param.name === THRESHOLD_UNIT_PARAM
    )
  );

/**
 * What the preview names as the thing being measured: the column for a
 * column-level test, otherwise the table. The table falls back to its FQN
 * because the full entity — and with it `name` — is only loaded once the table
 * has been picked and fetched.
 */
export const getThresholdPreviewTarget = ({
  isColumnLevel,
  columnName,
  tableName,
  tableFqn,
}: {
  isColumnLevel: boolean;
  columnName?: string;
  tableName?: string;
  tableFqn?: string;
}): string | undefined => (isColumnLevel ? columnName : tableName ?? tableFqn);

// ─── Live preview ────────────────────────────────────────────────────────────

/**
 * Significant digits kept when normalizing a computed bound.
 *
 * Double arithmetic noise (`110 * 1.05` → `115.50000000000001`) appears around
 * the 16th significant digit, so trimming to 12 removes it. Rounding to a
 * fixed number of *decimals* cannot: 6 decimals turns an effective bound of
 * `9.5e-9` into `0` and erases the whole preview for small-valued metrics.
 */
const SIGNIFICANT_DIGITS = 12;

const normalizeValue = (value: number): number =>
  Number.isFinite(value)
    ? Number(value.toPrecision(SIGNIFICANT_DIGITS))
    : value;

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
 * Mirrors ingestion's `thresholds.apply_bound_tolerance`, including `abs()` so
 * a negative bound widens outward. This is the number users actually reason
 * about, and computing it is what makes the zero-bound degenerate case
 * visible.
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

  return normalizeValue(bound + direction * delta);
};

export interface ThresholdPreviewInput {
  definition: TestDefinition;
  /** Raw react-hook-form `params` values — selects are `FormSelectItem`s. */
  params: Record<string, unknown>;
  /** Column name for column-level tests, table name for table-level ones. */
  target?: string;
  profilerConfig?: TableProfilerConfig;
}

export interface ThresholdSampling {
  kind: ThresholdSamplingKind;
  /** Rows or percent, for the static kinds only. */
  value?: number;
}

/**
 * Everything the preview needs to say, as data — no translated text. The
 * component turns it into a sentence so that every `t()` call stays inside
 * React, per the UI handbook.
 */
export interface ThresholdPreviewData {
  semantic: ThresholdTestSemantic;
  /** `0` when unset, which is exactly how ingestion reads a missing value. */
  threshold: number;
  isPercentage: boolean;
  noun: ThresholdNoun;
  target?: string;
  /** Statistical only: the configured bound, already formatted. */
  bound?: string;
  /** Statistical only: the bound after the deviation. Absent when there is none. */
  effectiveRange?: string;
  /** Custom SQL only: the raw comparison operator id. */
  operator?: string;
  /** Custom SQL only: sentence key for `operator`, absent for an unknown id. */
  operatorLabelKey?: string;
  /** Custom SQL only. */
  strategy?: CustomSqlStrategy;
  sampling?: ThresholdSampling;
  /** A percentage deviation is being applied around a bound of 0. */
  hasZeroBound: boolean;
  /**
   * No validator reads this test's threshold parameters yet, so the preview
   * must not present a tolerance as the pass/fail criterion.
   */
  isThresholdIgnored: boolean;
  /**
   * The test reads `threshold` but ignores `thresholdUnit` — true for
   * `tableCustomSQLQuery` with a PERCENTAGE unit, which `evaluate_threshold`
   * still compares as a raw count.
   */
  isUnitIgnored: boolean;
}

/**
 * How the table this test runs on is sampled, read from the profiler config.
 *
 * The values live under `profileSampleConfig.config`, not on
 * `TableProfilerConfig` itself, and `sampleConfigType` decides whether they
 * mean anything: a DYNAMIC config sizes the sample from the row count at run
 * time, so there is no percentage to quote up front.
 */
export const getThresholdSampling = (
  profilerConfig: TableProfilerConfig | undefined
): ThresholdSampling | undefined => {
  const sampleConfig = profilerConfig?.profileSampleConfig;
  if (!sampleConfig) {
    return undefined;
  }

  const staticConfig = sampleConfig.config;
  const isDynamic =
    sampleConfig.sampleConfigType === SampleConfigType.Dynamic ||
    Boolean(staticConfig?.smartSampling);

  if (isDynamic) {
    return { kind: ThresholdSamplingKind.Dynamic };
  }

  const profileSample = staticConfig?.profileSample;
  if (profileSample === undefined) {
    return undefined;
  }

  return {
    kind:
      staticConfig?.profileSampleType === ProfileSampleType.Rows
        ? ThresholdSamplingKind.StaticRows
        : ThresholdSamplingKind.StaticPercentage,
    value: profileSample,
  };
};

const getStatisticalPreview = (
  input: ThresholdPreviewInput,
  threshold: number,
  unit: string
):
  | Pick<ThresholdPreviewData, 'bound' | 'effectiveRange' | 'hasZeroBound'>
  | undefined => {
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
    return { bound, hasZeroBound: false };
  }

  const effectiveMin =
    min === undefined ? undefined : getEffectiveBound(min, threshold, unit, -1);
  const effectiveMax =
    max === undefined ? undefined : getEffectiveBound(max, threshold, unit, 1);

  return {
    bound,
    effectiveRange:
      effectiveMin !== undefined && effectiveMax !== undefined
        ? `${effectiveMin} – ${effectiveMax}`
        : (formatBound(effectiveMin, effectiveMax) as string),
    hasZeroBound: unit === ThresholdUnit.Percentage && (min === 0 || max === 0),
  };
};

/**
 * Builds the data behind the live preview of what the configured threshold
 * actually does. Returns `undefined` when the selected test has no
 * `thresholdUnit` param, or when a statistical test has no bound yet — in both
 * cases there is nothing truthful to say.
 */
export const getThresholdPreviewData = (
  input: ThresholdPreviewInput
): ThresholdPreviewData | undefined => {
  const { definition, params } = input;
  if (!hasThresholdUnitParam(definition)) {
    return undefined;
  }

  const threshold = toNumber(params[THRESHOLD_PARAM]) ?? 0;
  const unit =
    unwrapSelectValue(params[THRESHOLD_UNIT_PARAM]) ?? ThresholdUnit.Absolute;
  const semantic = getThresholdTestSemantic(definition.name);
  const isPercentage = unit === ThresholdUnit.Percentage;

  const common = {
    semantic,
    threshold,
    isPercentage,
    noun: getThresholdNoun(unit, definition.name),
    target: input.target,
    sampling: getThresholdSampling(input.profilerConfig),
    hasZeroBound: false,
    isThresholdIgnored: semantic === ThresholdTestSemantic.NotEnforced,
    isUnitIgnored: semantic === ThresholdTestSemantic.CustomSql && isPercentage,
  };

  if (semantic === ThresholdTestSemantic.Statistical) {
    const statistical = getStatisticalPreview(input, threshold, unit);

    return statistical ? { ...common, ...statistical } : undefined;
  }

  if (semantic === ThresholdTestSemantic.CustomSql) {
    const operator = unwrapSelectValue(params[OPERATOR_PARAM]) ?? '<=';

    return {
      ...common,
      operator,
      operatorLabelKey: OPERATOR_LABEL_KEYS[operator],
      strategy: (unwrapSelectValue(params[STRATEGY_PARAM]) ??
        CustomSqlStrategy.Rows) as CustomSqlStrategy,
    };
  }

  return common;
};

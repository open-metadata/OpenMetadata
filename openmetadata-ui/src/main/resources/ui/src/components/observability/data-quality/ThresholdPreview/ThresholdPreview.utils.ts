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
import {
  CustomSqlStrategy,
  ThresholdNoun,
  ThresholdPreviewData,
  ThresholdSampling,
  ThresholdSamplingKind,
  ThresholdTestSemantic,
  THRESHOLD_COUNT_NOUN_KEYS,
  THRESHOLD_NOUN_KEYS,
} from '../../../../utils/observability/data-quality/testCaseThreshold.utils';

/**
 * The threshold restated as "10 row(s)" / "1% of non-null values". Composed
 * from two keys rather than one pre-built sentence per case, because the noun
 * is contextual: the same stored unit reads as rows, non-null values or units
 * depending on the test.
 */
export const formatThresholdAmount = (
  threshold: number,
  isPercentage: boolean,
  noun: ThresholdNoun,
  t: TFunction
): string =>
  isPercentage
    ? t('message.threshold-amount-percentage', {
        value: threshold,
        noun: t(THRESHOLD_NOUN_KEYS[noun]),
      })
    : t('message.threshold-amount-absolute', {
        value: threshold,
        // "1 row(s)" — a bare count takes the noun's count form.
        noun: t(THRESHOLD_COUNT_NOUN_KEYS[noun]),
      });

export const formatSamplingNote = (
  sampling: ThresholdSampling | undefined,
  t: TFunction
): string | undefined => {
  if (!sampling) {
    return undefined;
  }

  // A dynamic config sizes the sample from the row count at run time, so there
  // is no share to quote up front — only the fact that a sample is in play.
  if (sampling.kind === ThresholdSamplingKind.Dynamic) {
    return t('message.dq-threshold-preview-sampling-dynamic');
  }

  const sample =
    sampling.kind === ThresholdSamplingKind.StaticRows
      ? t('message.threshold-amount-absolute', {
          value: sampling.value,
          noun: t(THRESHOLD_COUNT_NOUN_KEYS[ThresholdNoun.Rows]),
        })
      : t('label.percentage-value', { value: sampling.value });

  return t('message.dq-threshold-preview-sampling', { sample });
};

/**
 * "…falls outside 90 – 110, allowing a deviation of 5% (effective range
 * 85.5 – 115.5)" — the effective range is the number users reason about, and
 * showing it is what makes the zero-bound degenerate case visible.
 */
const formatStatisticalSentence = (
  data: ThresholdPreviewData,
  t: TFunction
): string => {
  const { bound, effectiveRange, isPercentage, threshold } = data;

  if (!effectiveRange) {
    return t('message.dq-threshold-preview-statistical', { bound });
  }

  return t('message.dq-threshold-preview-statistical-deviation', {
    bound,
    // The quantity the deviation is measured in is the metric's own — rows for
    // a row count, currency for a mean — so it is left unnamed rather than
    // called "units"; the effective range spells the result out anyway. The
    // bound a percentage is taken of is already in the sentence, so the clause
    // reads "a deviation of 5%", not "of 5% of the bound".
    amount: isPercentage
      ? t('label.percentage-value', { value: threshold })
      : String(threshold),
    range: effectiveRange,
  });
};

/** `tableCustomSQLQuery` compares its own result through its own operator. */
const formatCustomSqlSentence = (
  data: ThresholdPreviewData,
  amount: string,
  t: TFunction
): string => {
  const { isPercentage, operator, operatorLabelKey, strategy, threshold } =
    data;
  const operatorText = operatorLabelKey ? t(operatorLabelKey) : operator;

  // A COUNT query returns a bare number, so an absolute threshold is quoted
  // without a noun; a percentage is still a share of the table rows.
  return strategy === CustomSqlStrategy.Count
    ? t('message.dq-threshold-preview-custom-sql-count', {
        operator: operatorText,
        value: isPercentage ? amount : threshold,
      })
    : t('message.dq-threshold-preview-custom-sql-rows', {
        operator: operatorText,
        amount,
      });
};

/**
 * The sentence a user reads. Each branch mirrors the threshold reader that
 * actually runs in ingestion — a row tolerance, a widened bound, or
 * `tableCustomSQLQuery`'s own comparison. A test whose threshold no validator
 * reads yet gets no sentence at all, only the warning beside it.
 */
export const formatThresholdSentence = (
  data: ThresholdPreviewData,
  t: TFunction
): string | undefined => {
  const { semantic, threshold, isPercentage, noun, target } = data;
  const amount = formatThresholdAmount(threshold, isPercentage, noun, t);

  switch (semantic) {
    case ThresholdTestSemantic.Statistical:
      return formatStatisticalSentence(data, t);

    case ThresholdTestSemantic.CustomSql:
      return formatCustomSqlSentence(data, amount, t);

    case ThresholdTestSemantic.RowCountable:
      return t('message.dq-threshold-preview-row-countable', {
        amount,
        target: target ?? t('label.column-lowercase'),
      });

    default:
      return undefined;
  }
};

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

import { Alert, FormItemLabel } from '@openmetadata/ui-core-components';
import { FC, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { t } from '../../../../utils/i18next/LocalUtil';
import {
  CustomSqlStrategy,
  getThresholdPreviewData,
  ThresholdNoun,
  ThresholdPreviewData,
  ThresholdSampling,
  ThresholdSamplingKind,
  ThresholdTestSemantic,
  THRESHOLD_COUNT_NOUN_KEYS,
  THRESHOLD_NOUN_KEYS,
} from '../../../../utils/observability/data-quality/testCaseThreshold.utils';
import { ThresholdPreviewProps } from './ThresholdPreview.types';

/**
 * The threshold restated as "10 row(s)" / "1% of non-null values". Composed
 * from two keys rather than one pre-built sentence per case, because the noun
 * is contextual: the same stored unit reads as rows, non-null values or units
 * depending on the test.
 */
const formatAmount = (
  threshold: number,
  isPercentage: boolean,
  noun: ThresholdNoun
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

const formatSamplingNote = (
  sampling: ThresholdSampling | undefined
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
const formatStatisticalSentence = (data: ThresholdPreviewData): string => {
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
  amount: string
): string => {
  const { operator, operatorLabelKey, strategy, threshold } = data;
  const operatorText = operatorLabelKey ? t(operatorLabelKey) : operator;

  return strategy === CustomSqlStrategy.Count
    ? t('message.dq-threshold-preview-custom-sql-count', {
        operator: operatorText,
        value: threshold,
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
const formatSentence = (data: ThresholdPreviewData): string | undefined => {
  const { semantic, threshold, isPercentage, noun, target, isUnitIgnored } =
    data;

  // When the unit is not read for this test the threshold is a raw count
  // whatever the dropdown says, so the sentence says what will happen.
  const amount = formatAmount(
    threshold,
    isUnitIgnored ? false : isPercentage,
    isUnitIgnored ? ThresholdNoun.Rows : noun
  );

  switch (semantic) {
    case ThresholdTestSemantic.Statistical:
      return formatStatisticalSentence(data);

    case ThresholdTestSemantic.CustomSql:
      return formatCustomSqlSentence(data, amount);

    case ThresholdTestSemantic.RowCountable:
      return t('message.dq-threshold-preview-row-countable', {
        amount,
        target: target ?? t('label.column-lowercase'),
      });

    default:
      return undefined;
  }
};

/**
 * Live, plain-English restatement of what the configured threshold does, so
 * the meaning of `threshold` + `thresholdUnit` is never left to the user to
 * infer from two raw controls. Watches `params` so it follows every keystroke
 * without re-rendering the rest of the form.
 */
const ThresholdPreview: FC<ThresholdPreviewProps> = ({
  form,
  definition,
  target,
  profilerConfig,
}) => {
  // The sentence is composed by the helpers above, which translate through
  // `LocalUtil`'s `t` like the rest of `utils/`. The hook is still called so
  // the component re-renders — and the sentence is rebuilt — on a language
  // change.
  useTranslation();
  const params = useWatch({ control: form.control, name: 'params' });

  const data = useMemo(
    () =>
      getThresholdPreviewData({
        definition,
        params: (params ?? {}) as Record<string, unknown>,
        target,
        profilerConfig,
      }),
    [definition, params, target, profilerConfig]
  );

  if (!data) {
    return null;
  }

  const sentence = formatSentence(data);
  const samplingNote = formatSamplingNote(data.sampling);

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-2"
      data-testid="threshold-preview">
      <FormItemLabel label={t('label.preview')} />
      {sentence && (
        <p className="tw:mb-0" data-testid="threshold-preview-sentence">
          {sentence}
        </p>
      )}
      {samplingNote && (
        <p
          className="tw:mb-0 tw:text-tertiary"
          data-testid="threshold-sampling-warning">
          {samplingNote}
        </p>
      )}
      {data.needsMatchEnum && (
        <Alert
          data-testid="threshold-match-enum-warning"
          title={t('message.dq-threshold-preview-match-enum-required')}
          variant="warning"
        />
      )}
      {data.isThresholdIgnored && (
        <Alert
          data-testid="threshold-not-enforced-warning"
          title={t('message.dq-threshold-preview-not-enforced')}
          variant="warning"
        />
      )}
      {data.isUnitIgnored && (
        <Alert
          data-testid="threshold-unit-not-enforced-warning"
          title={t('message.dq-threshold-preview-unit-not-enforced')}
          variant="warning"
        />
      )}
      {data.hasZeroBound && (
        <Alert
          data-testid="threshold-zero-bound-warning"
          title={t('message.dq-threshold-preview-zero-bound')}
          variant="warning"
        />
      )}
    </div>
  );
};

export default ThresholdPreview;

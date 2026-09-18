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
import { TFunction } from 'i18next';
import { FC, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  CustomSqlStrategy,
  getThresholdPreviewData,
  THRESHOLD_NOUN_KEYS,
  ThresholdNoun,
  ThresholdPreviewData,
  ThresholdSampling,
  ThresholdSamplingKind,
  ThresholdTestSemantic,
} from '../../../../utils/observability/data-quality/testCaseThreshold.utils';
import { ThresholdPreviewProps } from './ThresholdPreview.types';

/**
 * The threshold restated as "10 rows" / "1% of non-null values". Composed from
 * two keys rather than one pre-built sentence per case, because the noun is
 * contextual: the same stored unit reads as rows, non-null values or units
 * depending on the test.
 */
const formatAmount = (
  t: TFunction,
  threshold: number,
  isPercentage: boolean,
  noun: ThresholdNoun
): string => {
  const nounText = t(THRESHOLD_NOUN_KEYS[noun]);

  return isPercentage
    ? t('message.threshold-amount-percentage', {
        value: threshold,
        noun: nounText,
      })
    : t('message.threshold-amount-absolute', {
        value: threshold,
        noun: nounText,
      });
};

const formatSamplingNote = (
  t: TFunction,
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
          noun: t(THRESHOLD_NOUN_KEYS[ThresholdNoun.Rows]),
        })
      : t('label.percentage-value', { value: sampling.value });

  return t('message.dq-threshold-preview-sampling', { sample });
};

/**
 * "…falls outside 90 – 110, allowing a 5% deviation (effective range
 * 85.5 – 115.5)" — the effective range is the number users reason about, and
 * showing it is what makes the zero-bound degenerate case visible.
 */
const formatStatisticalSentence = (
  t: TFunction,
  data: ThresholdPreviewData,
  amount: string
): string => {
  const { bound, effectiveRange, isPercentage, threshold } = data;

  if (!effectiveRange) {
    return t('message.dq-threshold-preview-statistical', { bound });
  }

  return t('message.dq-threshold-preview-statistical-deviation', {
    bound,
    // The bound the deviation is measured against is already in the sentence,
    // so the clause reads "a 5% deviation", not "a 5% of the bound deviation".
    amount: isPercentage
      ? t('label.percentage-value', { value: threshold })
      : amount,
    range: effectiveRange,
  });
};

/** `tableCustomSQLQuery` compares its own result through its own operator. */
const formatCustomSqlSentence = (
  t: TFunction,
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
const formatSentence = (
  t: TFunction,
  data: ThresholdPreviewData
): string | undefined => {
  const { semantic, threshold, isPercentage, noun, target, isUnitIgnored } =
    data;

  // When the unit is not read for this test the threshold is a raw count
  // whatever the dropdown says, so the sentence says what will happen.
  const amount = formatAmount(
    t,
    threshold,
    isUnitIgnored ? false : isPercentage,
    isUnitIgnored ? ThresholdNoun.Rows : noun
  );

  switch (semantic) {
    case ThresholdTestSemantic.Statistical:
      return formatStatisticalSentence(t, data, amount);

    case ThresholdTestSemantic.CustomSql:
      return formatCustomSqlSentence(t, data, amount);

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
  const { t } = useTranslation();
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

  const sentence = formatSentence(t, data);
  const samplingNote = formatSamplingNote(t, data.sampling);

  return (
    <div className="threshold-preview" data-testid="threshold-preview">
      <FormItemLabel label={t('label.preview')} />
      {sentence && <p data-testid="threshold-preview-sentence">{sentence}</p>}
      {samplingNote && (
        <p className="text-grey-muted" data-testid="threshold-sampling-warning">
          {samplingNote}
        </p>
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

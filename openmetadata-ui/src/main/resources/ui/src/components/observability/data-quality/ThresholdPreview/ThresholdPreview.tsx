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
import { getThresholdPreviewData } from '../../../../utils/observability/data-quality/testCaseThreshold.utils';
import { ThresholdPreviewProps } from './ThresholdPreview.types';
import {
  formatSamplingNote,
  formatThresholdSentence,
} from './ThresholdPreview.utils';

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

  const sentence = formatThresholdSentence(data, t);
  const samplingNote = formatSamplingNote(data.sampling, t);

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

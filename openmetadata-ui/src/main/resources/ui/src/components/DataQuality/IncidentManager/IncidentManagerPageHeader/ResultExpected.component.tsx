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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import type { ResultExpectedProps } from './TestCaseLastRunBanner.interface';

const ResultExpected = ({
  config,
  expectedValue,
  resultValue,
  show,
}: ResultExpectedProps) => {
  const { t } = useTranslation();

  if (!show) {
    return null;
  }

  return (
    <>
      <Box
        align="end"
        className="tw:min-w-32 tw:text-right"
        data-testid="test-case-result-expected"
        direction="col"
        justify="center">
        <Typography
          className="tw:uppercase"
          color="secondary"
          size="text-xs"
          weight="semibold">
          {t('label.result')} / {t('label.expected')}
        </Typography>
        {/* The result carries the weight. The expectation is tertiary, not the
            mock's lighter grey, which is 2.2:1 on the status tint. */}
        <Typography
          className="tw:mt-0.5 tw:whitespace-nowrap tw:font-mono"
          data-testid="test-case-result-value"
          size="text-sm">
          <Typography className={config.resultClassName} weight="bold">
            {resultValue}
          </Typography>
          <Typography color="secondary"> / {expectedValue}</Typography>
        </Typography>
      </Box>
      <span
        aria-hidden="true"
        className={`tw:border-l ${config.dividerClassName}`}
      />
    </>
  );
};

export default ResultExpected;

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
      <div
        className="tw:flex tw:min-w-32 tw:flex-col tw:items-end tw:justify-center tw:text-right"
        data-testid="test-case-result-expected">
        <span className="tw:text-xs tw:font-medium tw:tracking-wide tw:text-secondary tw:uppercase">
          {t('label.result')} / {t('label.expected')}
        </span>
        <span
          className="tw:mt-1 tw:whitespace-nowrap tw:text-xs tw:font-semibold"
          data-testid="test-case-result-value">
          <span className={config.resultClassName}>{resultValue}</span>
          <span className="tw:text-secondary"> / {expectedValue}</span>
        </span>
      </div>
      <span
        aria-hidden="true"
        className={`tw:border-l ${config.dividerClassName}`}
      />
    </>
  );
};

export default ResultExpected;

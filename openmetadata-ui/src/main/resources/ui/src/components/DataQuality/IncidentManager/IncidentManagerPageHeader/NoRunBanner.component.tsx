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

import { FeaturedIcon } from '@openmetadata/ui-core-components';
import { Minus } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { NO_RUN_BANNER_TEST_ID } from './TestCaseLastRunBanner.constants';
import type { NoRunBannerProps } from './TestCaseLastRunBanner.interface';
import { getNextRunLabel } from './TestCaseLastRunBanner.utils';

const NoRunBanner = ({ nextRunTimestamp }: NoRunBannerProps) => {
  const { t } = useTranslation();

  return (
    <div
      aria-live="polite"
      className="tw:min-w-0 tw:overflow-hidden tw:rounded-xl tw:border tw:border-l-4 tw:border-utility-gray-200 tw:border-l-utility-gray-400 tw:font-sans"
      data-testid={NO_RUN_BANNER_TEST_ID}
      role="status">
      <div
        className="tw:flex tw:flex-col tw:gap-4 tw:bg-secondary tw:px-5 tw:py-3.5 tw:lg:flex-row tw:lg:items-center"
        data-testid="test-case-last-run-summary">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-4">
          <FeaturedIcon
            outlined
            bgColor="white"
            color="gray"
            data-testid="test-case-last-run-icon"
            icon={Minus}
            radius="lg"
            shape="square"
            size="sm"
          />
          <div className="tw:min-w-0 tw:flex-1">
            <p className="tw:m-0 tw:text-sm tw:leading-snug">
              <span
                className="tw:text-sm tw:font-medium tw:text-primary"
                data-testid="test-case-last-run-prefix">
                {t('label.last-run')}
              </span>{' '}
              <span
                className="tw:font-semibold tw:text-secondary"
                data-testid="test-case-last-run-status">
                {t('label.not-run-yet')}
              </span>
            </p>
            <p className="tw:mt-1 tw:mb-0 tw:break-words tw:text-xs tw:leading-normal tw:text-secondary">
              {t('message.test-case-not-run-yet')}
            </p>
          </div>
        </div>
        <div className="tw:flex tw:min-w-36 tw:shrink-0 tw:flex-col tw:items-start tw:lg:items-end">
          <span
            aria-hidden="true"
            className="tw:text-sm tw:font-normal tw:text-primary">
            —
          </span>
          <span
            className="tw:mt-1 tw:whitespace-nowrap tw:text-xs tw:text-secondary"
            data-testid="test-case-next-run">
            {t('label.next')} ·{' '}
            {getNextRunLabel(
              nextRunTimestamp,
              t('label.in-lowercase'),
              t('label.not-scheduled')
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default NoRunBanner;

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
import { useTranslation } from 'react-i18next';
import type { LastRunBannerLayoutProps } from './TestCaseLastRunBanner.interface';

const LastRunBannerLayout = ({
  config,
  description,
  footer,
  rightSection,
}: LastRunBannerLayoutProps) => {
  const { t } = useTranslation();

  return (
    <div
      aria-live="polite"
      className={`tw:min-w-0 tw:overflow-hidden tw:rounded-xl tw:border tw:border-l-4 tw:font-sans ${config.containerClassName}`}
      data-testid={config.testId}
      role="status">
      <div
        className={`tw:flex tw:flex-col tw:gap-4 tw:px-5 tw:py-3.5 tw:lg:flex-row tw:lg:items-start ${config.summaryClassName}`}
        data-testid="test-case-last-run-summary">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-start tw:gap-4">
          <FeaturedIcon
            outlined
            aria-hidden="true"
            className="tw:self-start"
            color={config.iconColor}
            data-testid="test-case-last-run-icon"
            icon={config.icon}
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
                className={`tw:font-semibold ${config.statusClassName}`}
                data-testid="test-case-last-run-status">
                {t(config.statusLabel)}
              </span>
            </p>
            {description}
          </div>
        </div>
        {rightSection}
      </div>
      {footer}
    </div>
  );
};

export default LastRunBannerLayout;

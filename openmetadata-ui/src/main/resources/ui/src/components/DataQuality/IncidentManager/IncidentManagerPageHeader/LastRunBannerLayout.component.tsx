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
  Box,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
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
    <Box
      aria-live="polite"
      className={`tw:min-w-0 tw:overflow-hidden tw:rounded-xl tw:border tw:border-l-4 ${config.containerClassName}`}
      data-testid={config.testId}
      direction="col"
      role="status">
      <Box
        className="tw:px-5 tw:py-3.5 tw:lg:flex-row tw:lg:items-start"
        data-testid="test-case-last-run-summary"
        direction="col"
        gap={4}>
        <Box align="start" className="tw:min-w-0 tw:flex-1" gap={4}>
          <FeaturedIcon
            outlined
            bgColor="white"
            className="tw:self-start"
            color={config.iconColor}
            data-testid="test-case-last-run-icon"
            icon={config.icon}
            radius="lg"
            shape="square"
            size="md"
          />
          <Box className="tw:min-w-0 tw:flex-1" direction="col">
            <Typography
              as="div"
              data-testid="test-case-last-run-title"
              size="text-md">
              <Typography
                className="tw:text-primary"
                data-testid="test-case-last-run-prefix"
                weight="medium">
                {t('label.last-run-sentence')}
              </Typography>{' '}
              <Typography
                className={config.statusClassName}
                data-testid="test-case-last-run-status"
                weight="semibold">
                {t(config.statusLabel)}
              </Typography>
            </Typography>
            {description}
          </Box>
        </Box>
        {rightSection}
      </Box>
      {footer}
    </Box>
  );
};

export default LastRunBannerLayout;

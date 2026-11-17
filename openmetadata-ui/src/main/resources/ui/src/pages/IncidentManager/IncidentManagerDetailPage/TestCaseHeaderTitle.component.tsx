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
import classNames from 'classnames';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import CopyButton from '../../../components/common/CopyButton/CopyButton';
import type { TestCase } from '../../../generated/tests/testCase';
import { renderHighlightedText } from '../../../utils/EntitySearchUtils';
import type { UseTestCaseDetailPageResult } from './useTestCaseDetailPage';

interface TestCaseHeaderTitleProps {
  deleted?: TestCase['deleted'];
  displayName: UseTestCaseDetailPageResult['displayName'];
  testCaseName: TestCase['name'];
}

const breakableTooltipText = (text?: ReactNode) => (
  <span className="tw:block tw:max-w-full tw:break-words">{text}</span>
);

const TestCaseHeaderTitle = ({
  deleted,
  displayName,
  testCaseName,
}: TestCaseHeaderTitleProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:min-w-0"
      data-testid="entity-header-title"
      gap={3}>
      <Box className="tw:min-w-0" direction="col">
        {displayName && (
          <Typography
            as="h2"
            className="tw:m-0 tw:min-w-0 tw:truncate tw:text-primary tw:text-left"
            data-testid="entity-header-display-name"
            ellipsis={{
              tooltip: breakableTooltipText(renderHighlightedText(displayName)),
            }}
            size="text-lg"
            weight="bold">
            {renderHighlightedText(displayName)}
          </Typography>
        )}
        <Typography
          as={displayName ? 'span' : 'h2'}
          className={classNames(
            'tw:m-0 tw:block tw:min-w-0 tw:truncate tw:text-left',
            {
              'tw:text-primary': !displayName,
              'tw:text-tertiary': displayName,
            }
          )}
          data-testid="entity-header-name"
          ellipsis={{ tooltip: breakableTooltipText(testCaseName) }}
          size={displayName ? 'text-sm' : 'text-lg'}
          weight={displayName ? 'medium' : 'bold'}>
          {testCaseName}
        </Typography>
      </Box>
      {deleted && (
        <span
          className="deleted-badge-button tw:shrink-0"
          data-testid="deleted-badge">
          {t('label.deleted')}
        </span>
      )}
      <CopyButton
        testId="entity-header-copy-button"
        tooltip={t('label.copy-item', { item: t('label.url-uppercase') })}
        value={globalThis.location.href}
      />
    </Box>
  );
};

export default TestCaseHeaderTitle;

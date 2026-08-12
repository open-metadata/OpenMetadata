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
  Button,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy01 } from '@untitledui/icons';
import classNames from 'classnames';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TestCase } from '../../../generated/tests/testCase';
import { stringToHTML } from '../../../utils/StringUtils';
import type { UseTestCaseDetailPageResult } from './useTestCaseDetailPage';

interface TestCaseHeaderTitleProps {
  displayName: UseTestCaseDetailPageResult['displayName'];
  hasCopied: boolean;
  testCaseName: TestCase['name'];
  onCopy: () => Promise<void>;
}

const breakableTooltipText = (text?: ReactNode) => (
  <span className="tw:block tw:max-w-full tw:break-words">{text}</span>
);

const TestCaseHeaderTitle = ({
  displayName,
  hasCopied,
  testCaseName,
  onCopy,
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
              tooltip: breakableTooltipText(stringToHTML(displayName)),
            }}
            size="text-lg"
            weight="bold">
            {stringToHTML(displayName)}
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
      <Tooltip
        placement="top"
        title={
          hasCopied
            ? t('message.link-copy-to-clipboard')
            : t('label.copy-item', {
                item: t('label.url-uppercase'),
              })
        }>
        <Button
          aria-label={t('label.copy-item', {
            item: t('label.url-uppercase'),
          })}
          color="tertiary"
          data-testid="entity-header-copy-button"
          iconLeading={Copy01}
          size="xs"
          type="button"
          onClick={onCopy}
        />
      </Tooltip>
    </Box>
  );
};

export default TestCaseHeaderTitle;

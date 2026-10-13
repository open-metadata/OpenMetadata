/*
 *  Copyright 2025 Collate.
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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';

export interface WidgetEmptyStateProps {
  icon?: ReactElement;
  title?: string;
  description?: string;
  showActionButton?: boolean;
  actionButtonText?: string;
  actionButtonLink?: string;
  onActionClick?: () => void;
  className?: string;
  dataTestId?: string;
}

const WidgetEmptyState = ({
  icon,
  title,
  description,
  showActionButton = false,
  actionButtonText,
  actionButtonLink,
  onActionClick,
  className = '',
  dataTestId = 'widget-empty-state',
}: WidgetEmptyStateProps) => {
  const { t } = useTranslation();

  const buttonLabel = actionButtonText || t('label.explore');

  return (
    <Box
      align="center"
      className={classNames(
        'widget-empty-state tw:h-full tw:min-h-50 tw:p-6',
        className
      )}
      data-testid={dataTestId}
      justify="center">
      <ErrorPlaceHolder
        className="border-none"
        icon={icon}
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Box align="center" direction="col">
          {title && (
            <Typography
              className="tw:mb-3 tw:text-secondary"
              size="text-md"
              weight="semibold">
              {title}
            </Typography>
          )}
          {description && (
            <Typography
              className="tw:max-w-75 tw:text-center tw:text-quaternary"
              size="text-sm">
              {description}
            </Typography>
          )}
          {showActionButton && (
            <Button className="tw:mt-4" size="sm" onPress={onActionClick}>
              {buttonLabel}
            </Button>
          )}
          {actionButtonLink && (
            <Button className="tw:mt-4" href={actionButtonLink} size="sm">
              {buttonLabel}
            </Button>
          )}
        </Box>
      </ErrorPlaceHolder>
    </Box>
  );
};

export default WidgetEmptyState;

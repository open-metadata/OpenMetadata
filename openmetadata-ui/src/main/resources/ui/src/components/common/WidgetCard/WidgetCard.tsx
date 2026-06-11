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
import {
  ButtonUtility,
  Card,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { InfoCircle } from '@untitledui/icons';
import classNames from 'classnames';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CardExpandCollapseIcon } from '../../../assets/svg/ic-card-expand-collapse.svg';
import { WidgetCardProps } from './WidgetCard.interface';

const WidgetCard = ({
  children,
  title,
  titleIcon,
  headerExtra,
  defaultExpanded = true,
  onExpandStateChange,
  isExpandDisabled = false,
  helperText,
  dataTestId,
  className,
}: WidgetCardProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleExpandClick = useCallback(() => {
    setIsExpanded((prev) => {
      onExpandStateChange?.(prev);

      return !prev;
    });
  }, [onExpandStateChange]);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  return (
    <Card
      className={classNames('tw:w-full', className)}
      data-testid={dataTestId}
      size="sm">
      <Card.Header
        className="tw:border-0 tw:p-4"
        extra={
          <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-1">
            {!isExpandDisabled && (
              <ButtonUtility
                className={classNames(
                  'tw:p-0.5 tw:transition-transform tw:duration-200 tw:mt-0.5',
                  { 'tw:rotate-180': !isExpanded }
                )}
                color="tertiary"
                data-testid="expand-collapse-icon"
                disabled={isExpandDisabled}
                icon={<CardExpandCollapseIcon className="tw:h-4 tw:w-4" />}
                title={isExpanded ? t('label.collapse') : t('label.expand')}
                onClick={handleExpandClick}
              />
            )}
          </div>
        }
        title={
          <div className="tw:flex tw:items-center tw:gap-2">
            {titleIcon}
            {title && (
              <Typography
                as="span"
                className="tw:text-gray-500"
                size="text-sm"
                weight="semibold">
                {title}
              </Typography>
            )}
            {helperText && (
              <Tooltip title={helperText}>
                <TooltipTrigger className="tw:leading-0">
                  <InfoCircle
                    className="tw:cursor-pointer tw:text-gray-400"
                    size={14}
                    strokeWidth={2}
                  />
                </TooltipTrigger>
              </Tooltip>
            )}
            {headerExtra}
          </div>
        }
      />
      {isExpanded && children && (
        <Card.Content className="tw:pb-4 tw:pt-0">{children}</Card.Content>
      )}
    </Card>
  );
};

export default WidgetCard;

/*
 *  Copyright 2023 Collate.
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
  ProgressBarCircle,
  SkeletonParagraph,
  Typography,
} from '@openmetadata/ui-core-components';

import classNames from 'classnames';
import { isNumber, round } from 'lodash';
import { useMemo } from 'react';
import { formatNumberWithComma } from '../../../utils/NumberUtils';
import './summary-card.style.less';
import { SummaryCardProps } from './SummaryCard.interface';

export const SummaryCard = ({
  type,
  title,
  value,
  total,
  showProgressBar = true,
  className,
  isLoading = false,
  inverseLabel,
  titleIcon,
  cardBackgroundClass,
}: SummaryCardProps) => {
  const percent = useMemo(() => {
    if (isNumber(value)) {
      // Empty summaries have no completed work; dividing by zero would produce an invalid progress value.
      return round((total > 0 ? value / total : 0) * 100, 1);
    }

    return 0;
  }, [total, value]);

  if (isLoading) {
    return (
      <div
        className={classNames('summary-card', className)}
        data-testid="skeleton-loading">
        <SkeletonParagraph />
      </div>
    );
  }

  return (
    // Top-aligned: callers stretch cards in a row to one height, and a
    // centred label then floats mid-card on the shorter ones.
    <Box
      inline
      align="start"
      className={`layout-space layout-space-horizontal ${classNames(
        'summary-card',
        cardBackgroundClass,
        className
      )}`}
      data-testid="summary-card-container"
      gap={2}
      itemClassName="layout-space-item">
      <div
        className={classNames({ 'inverse-label': inverseLabel })}
        data-testid="summary-card-label">
        <Box
          inline
          align="center"
          className="layout-space layout-space-horizontal"
          gap={2}
          itemClassName="layout-space-item">
          {titleIcon}
          <Typography
            as="p"
            className="summary-card-title"
            data-testid="summary-card-title">
            {title}
          </Typography>
        </Box>
        <Typography
          as="p"
          className="summary-card-description"
          data-testid="summary-card-description">
          {isNumber(value) ? formatNumberWithComma(value) : value}
        </Typography>
      </div>

      {showProgressBar && (
        <div className={type} data-testid="progress-bar">
          <ProgressBarCircle
            color={
              (
                {
                  success: 'success',
                  failed: 'error',
                  aborted: 'warning',
                  assigned: 'purple',
                } as const
              )[type as 'success' | 'failed' | 'aborted' | 'assigned'] ??
              'brand'
            }
            size="xxs"
            value={Math.min(100, Math.max(0, percent))}
            valueFormatter={() => `${percent}%`}
          />
        </div>
      )}
    </Box>
  );
};

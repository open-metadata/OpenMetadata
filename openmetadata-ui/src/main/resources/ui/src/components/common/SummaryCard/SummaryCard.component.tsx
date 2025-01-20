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
import { Progress, Skeleton, Space, Typography } from 'antd';
import classNames from 'classnames';
import { isNumber, round } from 'lodash';
import React, { useMemo } from 'react';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import { progressBarFormatter } from '../../../utils/ProgressBar/ProgressBar.utils';
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
      return round((value / total) * 100, 1);
    }

    return 0;
  }, [total, value]);

  if (isLoading) {
    return (
      <div
        className={classNames('summary-card', className)}
        data-testid="skeleton-loading">
        <Skeleton active loading />
      </div>
    );
  }

  return (
    <Space
      className={classNames('summary-card', cardBackgroundClass, className)}
      data-testid="summary-card-container">
      <div
        className={classNames({ 'inverse-label': inverseLabel })}
        data-testid="summary-card-label">
        <Space align="center" size={8}>
          {titleIcon}
          <Typography.Paragraph
            className="summary-card-title"
            data-testid="summary-card-title">
            {title}
          </Typography.Paragraph>
        </Space>
        <Typography.Paragraph
          className="summary-card-description"
          data-testid="summary-card-description">
          {isNumber(value) ? formatNumberWithComma(value) : value}
        </Typography.Paragraph>
      </div>

      {showProgressBar && (
        <Progress
          className={type}
          data-testid="progress-bar"
          format={progressBarFormatter}
          percent={percent}
          type="circle"
          width={65}
        />
      )}
    </Space>
  );
};

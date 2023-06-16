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
import { Progress, Space, Typography } from 'antd';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { formatNumberWithComma } from 'utils/CommonUtils';
import './summary-card.style.less';
import { SummaryCardProps } from './SummaryCard.interface';

export const SummaryCard = ({
  type,
  title,
  value,
  total,
  showProgressBar = true,
  className,
}: SummaryCardProps) => {
  const isStringValue = typeof value === 'string';

  const percent = useMemo(() => {
    if (!isStringValue) {
      return (value / total) * 100;
    }

    return 0;
  }, [total, value, isStringValue]);

  return (
    <Space className={classNames('summary-card', className)}>
      <div>
        <Typography.Paragraph className="summary-card-title">
          {title}
        </Typography.Paragraph>
        <Typography.Paragraph className="summary-card-description">
          {isStringValue ? value : formatNumberWithComma(value)}
        </Typography.Paragraph>
      </div>
      {showProgressBar && (
        <Progress className={type} percent={percent} type="circle" width={65} />
      )}
    </Space>
  );
};

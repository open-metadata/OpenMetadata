/*
 *  Copyright 2022 Collate.
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

import { Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ChangeInValueIndicatorProps {
  changeInValue: number;
  suffix: string;
  duration?: number;
}

const ChangeInValueIndicator = ({
  changeInValue,
  suffix,
  duration,
}: ChangeInValueIndicatorProps) => {
  const { t } = useTranslation();

  return (
    <Typography.Paragraph className="data-insight-label-text text-xs">
      <Typography.Text type={changeInValue >= 0 ? 'success' : 'danger'}>
        {changeInValue >= 0 ? '+' : ''}
        {changeInValue.toFixed(2)}
        {suffix}
      </Typography.Text>{' '}
      {duration
        ? t('label.days-change-lowercase', {
            days: duration,
          })
        : ''}
    </Typography.Paragraph>
  );
};

export default ChangeInValueIndicator;

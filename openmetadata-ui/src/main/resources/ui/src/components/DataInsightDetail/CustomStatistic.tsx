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

import { Space, Typography } from 'antd';
import { isNil } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ChangeInValueIndicator from './ChangeInValueIndicator';

interface CustomStatisticProps {
  value: number | string;
  label?: string;
  changeInValue?: number;
  duration?: number;
  suffix?: string;
}

const CustomStatistic = ({
  value,
  label,
  changeInValue,
  duration,
  suffix = '%',
}: CustomStatisticProps) => {
  const { t } = useTranslation();

  return (
    <Space direction="vertical" size={0} style={{ margin: 0 }}>
      <Typography.Text className="data-insight-label-text">
        {label ?? t('label.latest')}
      </Typography.Text>
      <Typography.Text className="font-bold text-lg">{value}</Typography.Text>
      {changeInValue && !isNil(changeInValue) ? (
        <ChangeInValueIndicator
          changeInValue={changeInValue}
          duration={duration}
          suffix={suffix}
        />
      ) : (
        ''
      )}
    </Space>
  );
};

export default CustomStatistic;

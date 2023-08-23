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
import { isNil } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface CustomStatisticProps {
  value: number | string;
  label?: string;
  changeInValue?: number;
  duration?: number;
}

const CustomStatistic = ({
  value,
  label,
  changeInValue,
  duration,
}: CustomStatisticProps) => {
  const { t } = useTranslation();

  return (
    <div className="d-flex justify-between">
      <div className="d-flex flex-col">
        <Typography.Text className="font-medium">{label}</Typography.Text>
        <Typography.Text className="font-bold text-2xl">
          {value}
        </Typography.Text>
      </div>
      <div className="d-flex flex-col justify-end text-right">
        {Boolean(changeInValue) && !isNil(changeInValue) && (
          <Typography.Paragraph className="m-b-0">
            <Typography.Text
              className="d-block"
              type={changeInValue >= 0 ? 'success' : 'danger'}>
              {`${changeInValue >= 0 ? '+' : ''}${changeInValue.toFixed(2)}%`}
            </Typography.Text>
            <Typography.Text className="d-block">
              {Boolean(duration) &&
                t('label.days-change-lowercase', {
                  days: duration,
                })}
            </Typography.Text>
          </Typography.Paragraph>
        )}
      </div>
    </div>
  );
};

export default CustomStatistic;

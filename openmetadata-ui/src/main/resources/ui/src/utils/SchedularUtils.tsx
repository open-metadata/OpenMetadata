/*
 *  Copyright 2024 Collate.
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

import { Select } from 'antd';
import { CronOption } from '../components/Settings/Services/AddIngestion/Steps/ScheduleInterval.interface';
import { CronTypes } from '../enums/Schedular.enum';
import { FieldTypes, FormItemLayout } from '../interface/FormUtils.interface';
import { getHourOptions, getMinuteOptions } from './CronExpressionUtils';
import i18n from './i18next/LocalUtil';

const getOptionComponent = () => {
  const optionRenderer = (o: CronOption) => {
    return { label: o.label, value: o.value };
  };

  return optionRenderer;
};

export const getHourMinuteSelect = ({
  cronType,
  disabled = false,
}: {
  cronType: CronTypes.MINUTE | CronTypes.HOUR;
  disabled?: boolean;
}) => (
  <Select
    className="w-full"
    data-testid={`${cronType}-options`}
    disabled={disabled}
    id={`${cronType}-select`}
    options={
      cronType === CronTypes.MINUTE
        ? getMinuteOptions().map(getOptionComponent())
        : getHourOptions().map(getOptionComponent())
    }
  />
);

export const getRaiseOnErrorFormField = (
  onFocus?: (fieldName: string) => void
) => {
  return {
    name: 'raiseOnError',
    label: i18n.t('label.raise-on-error'),
    type: FieldTypes.SWITCH,
    required: false,
    formItemProps: {
      valuePropName: 'checked',
    },
    props: {
      onFocus: () => onFocus?.('raiseOnError'),
    },
    formItemLayout: FormItemLayout.HORIZONTAL,
    id: 'root/raiseOnError',
  };
};

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

import { Select } from 'antd';
import { isNaN, toNumber } from 'lodash';
import React from 'react';
import {
  combinations,
  getDayCron,
  getDayOptions,
  getHourCron,
  getHourOptions,
  getMinuteOptions,
  getPeriodOptions,
  getWeekCron,
} from '../components/common/CronEditor/CronEditor.constant';
import {
  Combination,
  CronOption,
  StateValue,
} from '../components/common/CronEditor/CronEditor.interface';
import { CronTypes } from '../enums/Cron.enum';
import { AppType } from '../generated/entity/applications/app';

export const getCron = (state: StateValue) => {
  const { selectedPeriod, ...otherValues } = state;

  switch (selectedPeriod) {
    case 'hour':
      return getHourCron(otherValues);
    case 'day':
      return getDayCron(otherValues);
    case 'week':
      return getWeekCron(otherValues);
    default:
      return otherValues.scheduleInterval;
  }
};

const getCronType = (cronStr: string) => {
  for (const c in combinations) {
    if (combinations[c as keyof Combination].test(cronStr)) {
      return c;
    }
  }

  return 'custom';
};

export const getStateValue = (valueStr: string) => {
  const d = valueStr ? valueStr.split(' ') : [];
  const min = toNumber(d[0]);
  const hour = toNumber(d[1]);
  const dow = toNumber(d[4]);

  const cronType = getCronType(valueStr);

  const stateVal: StateValue = {
    selectedPeriod: cronType,
    scheduleInterval: valueStr,
    min,
    hour,
    dow: isNaN(dow) ? 1 : dow,
  };

  return stateVal;
};

export const getCronInitialValue = (appType: AppType, appName: string) => {
  const value = {
    min: 0,
    hour: 0,
  };

  let initialValue = getHourCron(value);

  if (appName === 'DataInsightsReportApplication') {
    initialValue = getWeekCron({ ...value, dow: 0 });
  } else if (appType === AppType.External) {
    initialValue = getDayCron(value);
  }

  return initialValue;
};

const getOptionComponent = () => {
  const optionRenderer = (o: CronOption) => {
    return { label: o.label, value: o.value };
  };

  return optionRenderer;
};

export const getCronOptions = () => {
  const periodOptions = getPeriodOptions();
  const dayOptions = getDayOptions();

  return {
    periodOptions,
    dayOptions,
  };
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

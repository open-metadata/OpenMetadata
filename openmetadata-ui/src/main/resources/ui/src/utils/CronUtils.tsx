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
  Combination,
  CronOption,
  StateValue,
} from '../components/Settings/Services/AddIngestion/Steps/ScheduleInterval.interface';
import {
  CRON_COMBINATIONS,
  MONTHS_LIST,
} from '../constants/Schedular.constants';
import { CronTypes } from '../enums/Cron.enum';

export const getRange = (n: number) => {
  return [...Array(n).keys()];
};

export const getRangeOptions = (n: number) => {
  return getRange(n).map((v) => {
    return {
      label: `0${v}`.slice(-2),
      value: v,
    };
  });
};

export const getMinuteOptions = () => {
  return getRangeOptions(60);
};

export const getHourOptions = () => {
  return getRangeOptions(24);
};

const ordinalSuffix = (n: number) => {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const val = n % 100;

  return `${n}${suffixes[(val - 20) % 10] || suffixes[val] || suffixes[0]}`;
};

export const getMonthDaysOptions = () =>
  getRange(31).map((v) => {
    return {
      label: ordinalSuffix(v + 1),
      value: v + 1,
    };
  });

export const getMonthOptions = () =>
  MONTHS_LIST.map((month, index) => {
    return {
      label: month,
      value: index + 1,
    };
  });

export const getMinuteCron = (value: Partial<StateValue>) => {
  return `*/${value.min} * * * *`;
};

export const getHourCron = (value: Partial<StateValue>) => {
  return `${value.min} * * * *`;
};

export const getDayCron = (value: Partial<StateValue>) => {
  return `${value.min} ${value.hour} * * *`;
};

export const getWeekCron = (value: Partial<StateValue>) => {
  return `${value.min} ${value.hour} * * ${value.dow}`;
};

export const getCron = (state: StateValue) => {
  const { selectedPeriod, cron } = state;

  switch (selectedPeriod) {
    case 'hour':
      return getHourCron(state);
    case 'day':
      return getDayCron(state);
    case 'week':
      return getWeekCron(state);
    default:
      return cron;
  }
};

const getCronType = (cronStr: string) => {
  for (const c in CRON_COMBINATIONS) {
    if (CRON_COMBINATIONS[c as keyof Combination].test(cronStr)) {
      return c;
    }
  }

  return 'custom';
};

export const getStateValue = (value?: string, defaultValue?: string) => {
  const a = value?.split(' ');
  const d = a ?? defaultValue?.split(' ') ?? [];

  const min = toNumber(d[0]);
  const hour = toNumber(d[1]);
  const dow = toNumber(d[4]);

  const cronType = getCronType(value ?? defaultValue ?? '');

  const stateVal: StateValue = {
    selectedPeriod: cronType,
    cron: value,
    min: isNaN(dow) ? 0 : min,
    hour: isNaN(dow) ? 0 : hour,
    dow: isNaN(dow) ? 1 : dow,
  };

  return stateVal;
};

export const getCronInitialValue = (appName: string) => {
  const value = {
    min: 0,
    hour: 0,
  };

  let initialValue = getDayCron(value);

  if (appName === 'DataInsightsReportApplication') {
    initialValue = getWeekCron({ ...value, dow: 0 });
  }

  return initialValue;
};

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

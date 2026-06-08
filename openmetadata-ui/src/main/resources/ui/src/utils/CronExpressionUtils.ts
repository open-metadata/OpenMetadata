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

import { isUndefined, toNumber, toString } from 'lodash';

import { RuleObject } from 'rc-field-form/es/interface';
import {
  Combination,
  StateValue,
  WorkflowExtraConfig,
} from '../components/Settings/Services/AddIngestion/Steps/ScheduleInterval.interface';
import {
  CRON_COMBINATIONS,
  DAY_OF_MONTH_PATTERN,
  DAY_OF_WEEK_PATTERN,
  DEFAULT_SCHEDULE_CRON_DAILY,
  DEFAULT_SCHEDULE_CRON_HOURLY,
  DEFAULT_SCHEDULE_CRON_MONTHLY,
  DEFAULT_SCHEDULE_CRON_WEEKLY,
  HOUR_PATTERN,
  MINUTE_PATTERN,
  MONTH_PATTERN,
} from '../constants/Schedular.constants';
import i18n from './i18next/LocalUtil';

export const getScheduleOptionsFromSchedules = (
  scheduleOptions: string[]
): string[] => {
  return scheduleOptions.map((scheduleOption) => {
    switch (scheduleOption) {
      case 'run_once':
        return '';
      case 'hourly':
        return 'hour';
      case 'daily':
        return 'day';
      case 'weekly':
        return 'week';
      case 'monthly':
        return 'month';
    }

    return '';
  });
};

export const getRange = (n: number) => {
  return [...Array(n).keys()];
};

export const getRangeOptions = (n: number) => {
  return getRange(n).map((v) => {
    return {
      label: `0${v}`.slice(-2),
      value: toString(v),
    };
  });
};

export const getMinuteOptions = () => {
  return getRangeOptions(60);
};

export const getHourOptions = () => {
  return getRangeOptions(24);
};

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

export const getMonthCron = (value: Partial<StateValue>) => {
  return `${value.min} ${value.hour} ${value.dom} * ${value.dow}`;
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
    case 'month':
      return getMonthCron(state);
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

  const min = d[0];
  const hour = d[1];
  const dom = d[2];
  const dow = d[4];

  const cronType = getCronType(value ?? defaultValue ?? '');

  const stateVal: StateValue = {
    selectedPeriod: cronType,
    cron: value,
    min,
    hour,
    dow,
    dom,
  };

  return stateVal;
};

export const getCronDefaultValue = (appName: string) => {
  const value = {
    min: '0',
    hour: '0',
  };

  let initialValue = getDayCron(value);

  if (appName === 'DataInsightsReportApplication') {
    initialValue = getWeekCron({ ...value, dow: '0' });
  }

  return initialValue;
};

export const getDefaultScheduleValue = ({
  defaultSchedule,
  includePeriodOptions,
  allowNoSchedule = false,
}: {
  defaultSchedule?: string;
  includePeriodOptions?: string[];
  allowNoSchedule?: boolean;
}) => {
  if (isUndefined(includePeriodOptions)) {
    return allowNoSchedule
      ? defaultSchedule
      : defaultSchedule || DEFAULT_SCHEDULE_CRON_DAILY;
  }

  if (allowNoSchedule && isUndefined(defaultSchedule)) {
    return defaultSchedule;
  }

  return getDefaultScheduleFromPeriod(includePeriodOptions);
};

export const getDefaultScheduleFromPeriod = (
  includePeriodOptions: string[]
) => {
  if (includePeriodOptions.includes('day')) {
    return DEFAULT_SCHEDULE_CRON_DAILY;
  } else if (includePeriodOptions.includes('week')) {
    return DEFAULT_SCHEDULE_CRON_WEEKLY;
  } else if (includePeriodOptions.includes('month')) {
    return DEFAULT_SCHEDULE_CRON_MONTHLY;
  } else if (includePeriodOptions.includes('hour')) {
    return DEFAULT_SCHEDULE_CRON_HOURLY;
  }

  return DEFAULT_SCHEDULE_CRON_DAILY;
};

export const getUpdatedStateFromFormState = <T>(
  currentState: StateValue,
  formValues: StateValue & WorkflowExtraConfig & T
) => {
  try {
    const newState = { ...currentState, ...formValues };
    let { min, hour, dow, dom } = newState;

    min = isNaN(toNumber(min)) ? '0' : min;
    hour = isNaN(toNumber(hour)) ? '0' : hour;
    const cronValue = newState.cron?.split(' ');

    switch (newState.selectedPeriod) {
      case 'week':
        dow = isNaN(toNumber(dow)) ? '1' : dow;
        dom = '*';

        break;
      case 'month':
        dom = isNaN(toNumber(dom)) ? '1' : dom;
        dow = '*';

        break;
      case 'custom':
        min = cronValue?.[0] ?? '0';
        hour = cronValue?.[1] ?? '0';
        dom = cronValue?.[2] ?? '*';
        dow = cronValue?.[4] ?? '*';

        break;
    }

    return {
      ...newState,
      min,
      hour,
      dow,
      dom,
    };
  } catch {
    return { ...currentState, ...formValues };
  }
};

export const cronValidator = async (_: RuleObject, value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return;
  }

  const cronParts = trimmedValue.split(' ');

  if (cronParts.length !== 5) {
    return Promise.reject(
      new Error(i18n.t('message.cron-invalid-field-count'))
    );
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronParts;

  if (!MINUTE_PATTERN.test(minute)) {
    return Promise.reject(
      new Error(i18n.t('message.cron-invalid-minute-field'))
    );
  }
  if (!HOUR_PATTERN.test(hour)) {
    return Promise.reject(new Error(i18n.t('message.cron-invalid-hour-field')));
  }
  if (!DAY_OF_MONTH_PATTERN.test(dayOfMonth)) {
    return Promise.reject(
      new Error(i18n.t('message.cron-invalid-day-of-month-field'))
    );
  }
  if (!MONTH_PATTERN.test(month)) {
    return Promise.reject(
      new Error(i18n.t('message.cron-invalid-month-field'))
    );
  }
  if (!DAY_OF_WEEK_PATTERN.test(dayOfWeek)) {
    return Promise.reject(
      new Error(i18n.t('message.cron-invalid-day-of-week-field'))
    );
  }

  try {
    const cronstrue = (await import('cronstrue/i18n')).default;
    const description = cronstrue.toString(trimmedValue);

    const isFrequencyInMinutes = /Every \d* *minute/.test(description);
    const isFrequencyInSeconds = /Every \d* *second/.test(description);

    if (isFrequencyInMinutes || isFrequencyInSeconds) {
      return Promise.reject(
        new Error(i18n.t('message.cron-less-than-hour-message'))
      );
    }

    return Promise.resolve();
  } catch {
    return Promise.reject(new Error(i18n.t('message.cron-invalid-expression')));
  }
};

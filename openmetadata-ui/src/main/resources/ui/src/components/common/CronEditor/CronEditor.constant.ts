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

import i18n from 'utils/i18next/LocalUtil';
import { Combination, ToDisplay } from './CronEditor.interface';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getPeriodOptions = () => {
  return [
    {
      label: i18n.t('label.none-lowercase'),
      value: '',
      prep: '',
    },
    {
      label: i18n.t('label.minute-plural'),
      value: 'minute',
      prep: '',
    },
    {
      label: i18n.t('label.hour-lowercase'),
      value: 'hour',
      prep: 'at',
    },
    {
      label: i18n.t('label.day-lowercase'),
      value: 'day',
      prep: 'at',
    },
    {
      label: i18n.t('label.week-lowercase'),
      value: 'week',
      prep: 'on',
    } /* ,
    {
      label: 'month',
      value: 'month',
      prep: 'on the'
    },
    {
      label: 'year',
      value: 'year',
      prep: 'on the'
    }*/,
  ];
};

export const toDisplay: ToDisplay = {
  minute: [],
  hour: ['min'],
  day: ['time'],
  week: ['dow', 'time'],
  month: ['dom', 'time'],
  year: ['dom', 'mon', 'time'],
};

export const combinations: Combination = {
  minute: /^(\*\/\d{1,2})\s(\*\s){3}\*$/, // "*/? * * * *"
  hour: /^\d{1,2}\s(\*\s){3}\*$/, // "? * * * *"
  day: /^(\d{1,2}\s){2}(\*\s){2}\*$/, // "? ? * * *"
  week: /^(\d{1,2}\s){2}(\*\s){2}\d{1,2}$/, // "? ? * * ?"
  month: /^(\d{1,2}\s){3}\*\s\*$/, // "? ? ? * *"
  year: /^(\d{1,2}\s){4}\*$/, // "? ? ? ? *"
};

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

export const getMinuteSegmentOptions = () => {
  return getRangeOptions(60).filter((v) => v.value !== 0 && v.value % 5 === 0);
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

export const getDayOptions = () => {
  return [
    {
      label: i18n.t('label.sunday'),
      value: 0,
    },
    {
      label: i18n.t('label.monday'),
      value: 1,
    },
    {
      label: i18n.t('label.tuesday'),
      value: 2,
    },
    {
      label: i18n.t('label.wednesday'),
      value: 3,
    },
    {
      label: i18n.t('label.thursday'),
      value: 4,
    },
    {
      label: i18n.t('label.friday'),
      value: 5,
    },
    {
      label: i18n.t('label.saturday'),
      value: 6,
    },
  ];
};

export const getMonthDaysOptions = () => {
  return getRange(31).map((v) => {
    return {
      label: ordinalSuffix(v + 1),
      value: v + 1,
    };
  });
};

export const monthsList = () => {
  return [
    i18n.t('label.january'),
    i18n.t('label.february'),
    i18n.t('label.march'),
    i18n.t('label.april'),
    i18n.t('label.may'),
    i18n.t('label.june'),
    i18n.t('label.july'),
    i18n.t('label.august'),
    i18n.t('label.september'),
    i18n.t('label.october'),
    i18n.t('label.november'),
    i18n.t('label.december'),
  ];
};

export const getMonthOptions = () => {
  return monthsList().map((m, index) => {
    return {
      label: m,
      value: index + 1,
    };
  });
};

export const getMinuteCron = (value: any) => {
  return `*/${value.min} * * * *`;
};

export const getHourCron = (value: any) => {
  return `${value.min} * * * *`;
};

export const getDayCron = (value: any) => {
  return `${value.min} ${value.hour} * * *`;
};

export const getWeekCron = (value: any) => {
  return `${value.min} ${value.hour} * * ${value.dow}`;
};

export const getMonthCron = (value: any) => {
  return `${value.min} ${value.hour} ${value.dom} * *`;
};

export const getYearCron = (value: any) => {
  return `${value.min} ${value.hour} ${value.dom} ${value.mon} *`;
};

/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getPeriodOptions = () => {
  return [
    /* {
      label: 'minute',
      value: 'minute',
      prep: ''
    },*/
    {
      label: 'hour',
      value: 'hour',
      prep: 'at',
    },
    {
      label: 'day',
      value: 'day',
      prep: 'at',
    },
    {
      label: 'week',
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

export const toDisplay = {
  minute: [],
  hour: ['min'],
  day: ['time'],
  week: ['dow', 'time'],
  month: ['dom', 'time'],
  year: ['dom', 'mon', 'time'],
};

export const combinations = {
  minute: /^(\*\s){4}\*$/, // "* * * * *"
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
      label: 'Sunday',
      value: 0,
    },
    {
      label: 'Monday',
      value: 1,
    },
    {
      label: 'Tuesday',
      value: 2,
    },
    {
      label: 'Wednesday',
      value: 3,
    },
    {
      label: 'Thursday',
      value: 4,
    },
    {
      label: 'Friday',
      value: 5,
    },
    {
      label: 'Saturday',
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
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
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

export const getMinuteCron = () => {
  return '* * * * *';
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

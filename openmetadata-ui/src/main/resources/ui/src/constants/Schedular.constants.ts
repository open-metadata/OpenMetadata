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

import { toString } from 'lodash';
import { Combination } from '../components/Settings/Services/AddIngestion/Steps/ScheduleInterval.interface';
import { SchedularOptions } from '../enums/Schedular.enum';
import i18n from '../utils/i18next/LocalUtil';

export const SCHEDULAR_OPTIONS = [
  {
    title: i18n.t('label.schedule'),
    description: i18n.t('message.schedule-description'),
    value: SchedularOptions.SCHEDULE,
  },
  {
    title: i18n.t('label.on-demand'),
    description: i18n.t('message.on-demand-description'),
    value: SchedularOptions.ON_DEMAND,
  },
];

export const PERIOD_OPTIONS = [
  {
    label: i18n.t('label.hour'),
    value: 'hour',
  },
  {
    label: i18n.t('label.day'),
    value: 'day',
  },
  {
    label: i18n.t('label.week'),
    value: 'week',
  },
  {
    label: i18n.t('label.month'),
    value: 'month',
  },
  {
    label: i18n.t('label.custom'),
    value: 'custom',
  },
];

export const DAY_OPTIONS = [
  {
    label: i18n.t('label.sunday'),
    value: '0',
  },
  {
    label: i18n.t('label.monday'),
    value: '1',
  },
  {
    label: i18n.t('label.tuesday'),
    value: '2',
  },
  {
    label: i18n.t('label.wednesday'),
    value: '3',
  },
  {
    label: i18n.t('label.thursday'),
    value: '4',
  },
  {
    label: i18n.t('label.friday'),
    value: '5',
  },
  {
    label: i18n.t('label.saturday'),
    value: '6',
  },
];

export const DAY_IN_MONTH_OPTIONS = [...Array(31).keys()].map((v) => {
  return {
    label: toString(v + 1),
    value: toString(v + 1),
  };
});

export const CRON_COMBINATIONS: Combination = {
  hour: /^\d{1,2}\s(\*\s){3}\*$/, // "? * * * *"
  day: /^(\d{1,2}\s){2}(\*\s){2}\*$/, // "? ? * * *"
  week: /^(\d{1,2}\s){2}(\*\s){2}\d{1,2}$/, // "? ? * * ?"
  month: /^(\d{1,2}\s){3}\*\s\*$/, // "? ? ? * *"
};

export const DEFAULT_SCHEDULE_CRON_HOURLY = '0 * * * *';
export const DEFAULT_SCHEDULE_CRON_DAILY = '0 0 * * *';
export const DEFAULT_SCHEDULE_CRON_WEEKLY = '0 0 * * 1';
export const DEFAULT_SCHEDULE_CRON_MONTHLY = '0 0 1 * *';

export const MINUTE_PATTERN =
  /^(\*(\/\d+)?|([0-5]?\d)(-([0-5]?\d)(\/\d+)?)?(,([0-5]?\d)(-([0-5]?\d)(\/\d+)?)?)*)$/;

export const HOUR_PATTERN =
  /^(\*(\/([01]?\d|2[0-3]))?|([01]?\d|2[0-3])(-([01]?\d|2[0-3])(\/\d+)?)?(,([01]?\d|2[0-3])(-([01]?\d|2[0-3])(\/\d+)?)?)*)$/;

export const DAY_OF_MONTH_PATTERN =
  /^(\*(\/\d+)?|([1-9]|[12]\d|3[01])(-([1-9]|[12]\d|3[01])(\/\d+)?)?(,([1-9]|[12]\d|3[01])(-([1-9]|[12]\d|3[01])(\/\d+)?)?)*)$/;

export const MONTH_PATTERN =
  /^(\*(\/\d+)?|([1-9]|1[0-2])(-([1-9]|1[0-2])(\/\d+)?)?(,([1-9]|1[0-2])(-([1-9]|1[0-2])(\/\d+)?)?)*)$/;

export const DAY_OF_WEEK_PATTERN =
  /^(\*(\/\d+)?|[0-6](-[0-6](\/\d+)?)?(,[0-6](-[0-6](\/\d+)?)?)*)$/;

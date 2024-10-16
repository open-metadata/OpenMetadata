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

import { t } from 'i18next';
import { Combination } from '../components/Settings/Services/AddIngestion/Steps/ScheduleInterval.interface';
import { SchedularOptions } from '../enums/Schedular.enum';
import i18n from '../utils/i18next/LocalUtil';

export const SCHEDULAR_OPTIONS = [
  {
    title: t('label.schedule'),
    description: t('message.schedule-description'),
    value: SchedularOptions.SCHEDULE,
  },
  {
    title: t('label.on-demand'),
    description: t('message.on-demand-description'),
    value: SchedularOptions.ON_DEMAND,
  },
];

export const PERIOD_OPTIONS = [
  {
    label: i18n.t('label.hour'),
    value: 'hour',
    prep: 'at',
  },
  {
    label: i18n.t('label.day'),
    value: 'day',
    prep: 'at',
  },
  {
    label: i18n.t('label.week'),
    value: 'week',
    prep: 'on',
  },
  {
    label: i18n.t('label.custom'),
    value: 'custom',
  },
];

export const DAY_OPTIONS = [
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

export const MONTHS_LIST = [
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

export const CRON_COMBINATIONS: Combination = {
  hour: /^\d{1,2}\s(\*\s){3}\*$/, // "? * * * *"
  day: /^(\d{1,2}\s){2}(\*\s){2}\*$/, // "? ? * * *"
  week: /^(\d{1,2}\s){2}(\*\s){2}\d{1,2}$/, // "? ? * * ?"
};

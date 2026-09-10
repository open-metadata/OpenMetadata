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

import {
  DAY_OF_MONTH_PATTERN,
  DAY_OF_WEEK_PATTERN,
  HOUR_PATTERN,
  MINUTE_PATTERN,
  MONTH_PATTERN,
} from '../../../../../constants/Schedular.constants';

export const PERIOD_CUSTOM = 'custom';

// Keep both arrays in cron field order so validation returns the error for the failing field.
export const CRON_FIELD_PATTERNS = [
  MINUTE_PATTERN,
  HOUR_PATTERN,
  DAY_OF_MONTH_PATTERN,
  MONTH_PATTERN,
  DAY_OF_WEEK_PATTERN,
];

export const CRON_FIELD_ERROR_KEYS = [
  'message.cron-invalid-minute-field',
  'message.cron-invalid-hour-field',
  'message.cron-invalid-day-of-month-field',
  'message.cron-invalid-month-field',
  'message.cron-invalid-day-of-week-field',
];

export const FREQUENCY_LABEL_KEYS: Record<string, string> = {
  hour: 'label.hourly',
  day: 'label.daily',
  week: 'label.weekly',
  month: 'label.monthly',
  custom: 'label.custom',
};

export const SELECTED_FREQUENCY_CLASS =
  'tw:bg-utility-brand-50 tw:text-brand-secondary tw:after:outline-brand tw:hover:bg-utility-brand-50 tw:hover:text-brand-secondary';

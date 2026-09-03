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
  CRON_FIELD_ERROR_KEYS,
  CRON_FIELD_PATTERNS,
} from './ScheduleInterval.constants';

const getMinuteRange = (range: string, hasStep: boolean): [number, number] => {
  if (range === '*') {
    return [0, 59];
  }

  if (range.includes('-')) {
    const [start, end] = range.split('-').map(Number);

    return [start, end];
  }

  const start = Number(range);

  return [start, hasStep ? 59 : start];
};

const hasDescendingMinuteRange = (minuteField: string): boolean =>
  minuteField.split(',').some((segment) => {
    const [range] = segment.split('/');

    if (!range.includes('-')) {
      return false;
    }

    const [start, end] = range.split('-').map(Number);

    return start > end;
  });

const hasMultipleRunsPerHour = (minuteField: string): boolean => {
  const minutes = new Set<number>();

  for (const segment of minuteField.split(',')) {
    const [range, stepValue] = segment.split('/');
    const step = stepValue ? Number(stepValue) : 1;

    if (step <= 0) {
      return true;
    }

    const [start, end] = getMinuteRange(range, Boolean(stepValue));

    for (let minute = start; minute <= end; minute += step) {
      minutes.add(minute);
      if (minutes.size > 1) {
        return true;
      }
    }
  }

  return false;
};

export const validateCronExpression = (cron: string): string | undefined => {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== CRON_FIELD_PATTERNS.length) {
    return 'message.cron-invalid-field-count';
  }

  for (let i = 0; i < parts.length; i++) {
    if (!CRON_FIELD_PATTERNS[i].test(parts[i])) {
      return CRON_FIELD_ERROR_KEYS[i];
    }
  }

  if (hasDescendingMinuteRange(parts[0])) {
    return CRON_FIELD_ERROR_KEYS[0];
  }

  // Only the minute field can schedule multiple executions within an hour.
  // Expanding its validated 0-59 grammar keeps this synchronous for input-time validation.
  if (hasMultipleRunsPerHour(parts[0])) {
    return 'message.cron-less-than-hour-message';
  }

  return undefined;
};

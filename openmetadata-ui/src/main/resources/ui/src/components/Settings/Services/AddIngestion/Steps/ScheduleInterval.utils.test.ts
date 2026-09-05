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

import { validateCronExpression } from './ScheduleInterval.utils';

describe('ScheduleInterval utilities', () => {
  it.each([
    ['0 0 * *', 'message.cron-invalid-field-count'],
    ['60 0 * * *', 'message.cron-invalid-minute-field'],
    ['0 24 * * *', 'message.cron-invalid-hour-field'],
    ['0 0 32 * *', 'message.cron-invalid-day-of-month-field'],
    ['0 0 * 13 *', 'message.cron-invalid-month-field'],
    ['0 0 * * 8', 'message.cron-invalid-day-of-week-field'],
    ['30-10 * * * *', 'message.cron-invalid-minute-field'],
  ])('returns %s validation error for malformed cron fields', (cron, error) => {
    expect(validateCronExpression(cron)).toBe(error);
  });

  it.each(['*/15 0 * * 1-5', '0/1 0 * * *'])(
    'rejects the sub-hour schedule %s',
    (cron) => {
      expect(validateCronExpression(cron)).toBe(
        'message.cron-less-than-hour-message'
      );
    }
  );

  it('accepts a valid hourly cron expression', () => {
    expect(validateCronExpression('0 * * * *')).toBeUndefined();
  });
});

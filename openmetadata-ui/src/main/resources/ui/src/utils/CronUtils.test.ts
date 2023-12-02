/*
 *  Copyright 2023 Collate.
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

import { getQuartzCronExpression } from './CronUtils';

describe('getQuartzCronExpression function', () => {
  it('should generate cron expression for every minute', () => {
    const state = {
      selectedPeriod: 'minute',
      selectedMinOption: { min: 1 },
      selectedHourOption: { min: 0 },
      selectedDayOption: { min: 0, hour: 0 },
      selectedWeekOption: { min: 0, hour: 0, dow: 0 },
      selectedMonthOption: { min: 0, hour: 0, dom: 1 },
      selectedYearOption: { min: 0, hour: 0, dom: 1, mon: 1 },
    };

    const result = getQuartzCronExpression(state);

    expect(result).toEqual('0 0/1 * * * ?');
  });

  it('should generate cron expression for every hour', () => {
    const state = {
      selectedPeriod: 'hour',
      selectedMinOption: { min: 0 },
      selectedHourOption: { min: 0 },
      selectedDayOption: { min: 0, hour: 0 },
      selectedWeekOption: { min: 0, hour: 0, dow: 0 },
      selectedMonthOption: { min: 0, hour: 0, dom: 1 },
      selectedYearOption: { min: 0, hour: 0, dom: 1, mon: 1 },
    };

    const result = getQuartzCronExpression(state);

    expect(result).toEqual('0 0 * * * ?');
  });

  it('should generate cron expression for specific time on a specific day of the month and month of the year', () => {
    const state = {
      selectedPeriod: 'year',
      selectedMinOption: { min: 0 },
      selectedHourOption: { min: 0 },
      selectedDayOption: { min: 0, hour: 0 },
      selectedWeekOption: { min: 0, hour: 0, dow: 0 },
      selectedMonthOption: { min: 0, hour: 0, dom: 0 },
      selectedYearOption: { min: 45, hour: 3, dom: 1, mon: 7 },
    };

    const result = getQuartzCronExpression(state);

    expect(result).toEqual('0 45 3 1 7 ?');
  });

  it('should generate cron expression for specific time daily', () => {
    const state = {
      selectedPeriod: 'day',
      selectedMinOption: { min: 0 },
      selectedHourOption: { min: 0 },
      selectedDayOption: { min: 15, hour: 8 },
      selectedWeekOption: { min: 0, hour: 0, dow: 0 },
      selectedMonthOption: { min: 0, hour: 0, dom: 0 },
      selectedYearOption: { min: 45, hour: 3, dom: 1, mon: 7 },
    };

    const result = getQuartzCronExpression(state);

    expect(result).toEqual('0 15 8 * * ?');
  });

  it('should generate cron expression for specific time on a specific day of the week', () => {
    const state = {
      selectedPeriod: 'week',
      selectedMinOption: { min: 0 },
      selectedHourOption: { min: 0 },
      selectedDayOption: { min: 15, hour: 8 },
      selectedWeekOption: { min: 30, hour: 10, dow: 3 },
      selectedMonthOption: { min: 0, hour: 0, dom: 0 },
      selectedYearOption: { min: 45, hour: 3, dom: 1, mon: 7 },
    };

    const result = getQuartzCronExpression(state);

    expect(result).toEqual('0 30 10 ? * 4');
  });
});

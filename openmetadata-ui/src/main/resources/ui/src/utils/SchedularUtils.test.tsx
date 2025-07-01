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

import {
  mockNewFormValue1,
  mockNewFormValue2,
  mockNewFormValue3,
  mockNewFormValue4,
  mockNewFormValue5,
  mockOldState1,
} from '../mocks/Schedular.mock';
import {
  cronValidator,
  getCronDefaultValue,
  getScheduleOptionsFromSchedules,
  getUpdatedStateFromFormState,
} from './SchedularUtils';

describe('getCronDefaultValue function', () => {
  it('should generate day cron expression if appType is internal and appName is not DataInsightsReportApplication', () => {
    const result = getCronDefaultValue('SearchIndexingApplication');

    expect(result).toEqual('0 0 * * *');
  });

  it('should generate week cron expression if appName is DataInsightsReportApplication', () => {
    const result = getCronDefaultValue('DataInsightsReportApplication');

    expect(result).toEqual('0 0 * * 0');
  });

  it('should generate day cron expression if appType is external', () => {
    const result = getCronDefaultValue('DataInsightsApplication');

    expect(result).toEqual('0 0 * * *');
  });
});

describe('getScheduleOptionsFromSchedules', () => {
  it('should return an empty array when input is an empty array', () => {
    const scheduleOptions: string[] = [];
    const result = getScheduleOptionsFromSchedules(scheduleOptions);

    expect(result).toEqual([]);
  });

  it('should map "run_once" to an empty string', () => {
    const scheduleOptions: string[] = ['run_once'];
    const result = getScheduleOptionsFromSchedules(scheduleOptions);

    expect(result).toEqual(['']);
  });

  it('should map "daily" to "day"', () => {
    const scheduleOptions: string[] = ['daily'];
    const result = getScheduleOptionsFromSchedules(scheduleOptions);

    expect(result).toEqual(['day']);
  });

  it('should map "weekly" to "week"', () => {
    const scheduleOptions: string[] = ['weekly'];
    const result = getScheduleOptionsFromSchedules(scheduleOptions);

    expect(result).toEqual(['week']);
  });

  it('should map "monthly" to "month"', () => {
    const scheduleOptions: string[] = ['monthly'];
    const result = getScheduleOptionsFromSchedules(scheduleOptions);

    expect(result).toEqual(['month']);
  });

  it('should map unknown options to an empty string', () => {
    const scheduleOptions: string[] = ['unknown', 'invalid'];
    const result = getScheduleOptionsFromSchedules(scheduleOptions);

    expect(result).toEqual(['', '']);
  });
});

describe('getUpdatedStateFromFormState', () => {
  it('should return hour value as 0 for non number hour value for hour selectedPeriod', () => {
    const result = getUpdatedStateFromFormState(
      mockOldState1,
      mockNewFormValue1
    );

    expect(result).toEqual({
      ...mockOldState1,
      ...mockNewFormValue1,
      hour: '0',
    });
  });

  it('should return hour and min value as 0 for non number values for day selectedPeriod', () => {
    const result = getUpdatedStateFromFormState(
      mockOldState1,
      mockNewFormValue2
    );

    expect(result).toEqual({
      ...mockOldState1,
      ...mockNewFormValue2,
      min: '0',
      hour: '0',
    });
  });

  it('should reset the dom, dow and hour value for non number values for week selectedPeriod', () => {
    const result = getUpdatedStateFromFormState(
      mockOldState1,
      mockNewFormValue3
    );

    expect(result).toEqual({
      ...mockOldState1,
      ...mockNewFormValue3,
      dom: '*',
      dow: '1',
      hour: '0',
    });
  });

  it('should reset the dom, dow and hour value for non number values for month selectedPeriod', () => {
    const result = getUpdatedStateFromFormState(
      mockOldState1,
      mockNewFormValue4
    );

    expect(result).toEqual({
      ...mockOldState1,
      ...mockNewFormValue4,
      dow: '*',
      dom: '1',
      hour: '0',
    });
  });

  it('should set the min, hour, dow, dom values as per cron', () => {
    const result = getUpdatedStateFromFormState(
      mockOldState1,
      mockNewFormValue5
    );

    expect(result).toEqual({
      ...mockOldState1,
      ...mockNewFormValue5,
      hour: '0',
      dow: '*',
      dom: '*',
    });
  });
});

describe('cronValidator', () => {
  it('should resolve for valid cron expression', async () => {
    await expect(cronValidator({}, '0 0 * * *')).resolves.toBeUndefined();
  });

  it('should reject for cron expression with frequency less than an hour', async () => {
    await expect(cronValidator({}, '*/30 * * * *')).rejects.toMatch(
      'message.cron-less-than-hour-message'
    );
  });

  it('should reject for invalid day of week (<0 or >6)', async () => {
    await expect(cronValidator({}, '0 0 * * 7')).rejects.toMatch(
      'message.cron-invalid-day-of-week-field'
    );
    await expect(cronValidator({}, '0 0 * * -1')).rejects.toMatch(
      'message.cron-invalid-day-of-week-field'
    );
  });

  it('should resolve for valid day of week (0-6)', async () => {
    await expect(cronValidator({}, '0 0 * * 0')).resolves.toBeUndefined();
    await expect(cronValidator({}, '0 0 * * 3')).resolves.toBeUndefined();
    await expect(cronValidator({}, '0 0 * * 6')).resolves.toBeUndefined();
  });

  it('should resolve for valid day of week range (0-6)', async () => {
    await expect(cronValidator({}, '0 0 * * 0-3')).resolves.toBeUndefined();
    await expect(cronValidator({}, '0 0 * * 4-6')).resolves.toBeUndefined();
  });

  it('should reject for invalid day of week range (<0 or >6)', async () => {
    await expect(cronValidator({}, '0 0 * * 4-7')).rejects.toMatch(
      'message.cron-invalid-day-of-week-field'
    );
    await expect(cronValidator({}, '0 0 * * -1-3')).rejects.toMatch(
      'message.cron-invalid-day-of-week-field'
    );
  });

  it('should reject for mixed valid and invalid day of week range', async () => {
    await expect(cronValidator({}, '0 0 * * 0-7')).rejects.toMatch(
      'message.cron-invalid-day-of-week-field'
    );
    await expect(cronValidator({}, '0 0 * * -1-6')).rejects.toMatch(
      'message.cron-invalid-day-of-week-field'
    );
  });

  it('should reject for invalid cron expression with more than 5 fields', async () => {
    await expect(cronValidator({}, '25 6 3 5 1 1')).rejects.toMatch(
      'message.cron-invalid-field-count'
    );
  });

  it('should reject for invalid cron expression with less than 5 fields', async () => {
    await expect(cronValidator({}, '25 6 3 5')).rejects.toMatch(
      'message.cron-invalid-field-count'
    );
  });
});

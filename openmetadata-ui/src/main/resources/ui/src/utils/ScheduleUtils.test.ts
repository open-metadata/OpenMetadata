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
import { getScheduleOptionsFromSchedules } from './ScheduleUtils';

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

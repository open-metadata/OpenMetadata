/*
 *  Copyright 2026 Collate.
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
  fromDateTimeEditState,
  toDateTimeEditState,
} from './DatePropertyValue.utils';

describe('DatePropertyValue.utils', () => {
  it.each([
    ['date-cp', 'dd-MM-yyyy', '09-07-2024'],
    ['dateTime-cp', 'MM/dd/yyyy HH:mm:ss', '07/09/2024 15:07:59'],
    ['dateTime-cp', 'yyyy-MM-dd HH:mm:ss.SSS', '2024-07-09 15:07:59.123'],
    ['time-cp', 'HH:mm:ss', '15:35:59'],
  ])('round-trips a %s value stored as %s', (typeName, format, stored) => {
    const state = toDateTimeEditState(stored, typeName, format);

    expect(fromDateTimeEditState(state, typeName, format)).toBe(stored);
  });

  it('splits a stored date-time into picker parts', () => {
    expect(
      toDateTimeEditState(
        '2024-07-09 15:07:59',
        'dateTime-cp',
        'yyyy-MM-dd HH:mm:ss'
      )
    ).toEqual({
      date: { year: 2024, month: 7, day: 9 },
      time: { hour: 15, minute: 7, second: 59 },
      millisecond: 0,
    });
  });

  it('defaults a missing time to midnight', () => {
    expect(
      fromDateTimeEditState(
        { date: { year: 2024, month: 7, day: 9 }, time: null, millisecond: 0 },
        'dateTime-cp',
        'yyyy-MM-dd HH:mm:ss'
      )
    ).toBe('2024-07-09 00:00:00');
  });

  it('clears the value when the driving part is empty', () => {
    const empty = { date: null, time: null, millisecond: 0 };

    expect(
      fromDateTimeEditState(empty, 'date-cp', 'yyyy-MM-dd')
    ).toBeUndefined();
    expect(fromDateTimeEditState(empty, 'time-cp', 'HH:mm:ss')).toBeUndefined();
  });

  it('starts empty for missing or unparseable values', () => {
    expect(toDateTimeEditState('garbage', 'date-cp', 'yyyy-MM-dd')).toEqual({
      date: null,
      time: null,
      millisecond: 0,
    });
  });
});

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
  dateValueToEndOfDayMillis,
  getPastDaysRange,
  millisToDateValue,
} from './calendarDate.utils';

describe('getPastDaysRange', () => {
  // A picked range runs from local midnight to the last millisecond of its end
  // day; the default window has to read the same in the picker's trigger.
  it('should span whole local days ending with today', () => {
    const { startTs, endTs } = getPastDaysRange(30);
    const start = new Date(startTs);
    const end = new Date(endTs);
    const now = new Date();

    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([
      0, 0, 0,
    ]);
    expect(end.toDateString()).toBe(now.toDateString());
    expect(new Date(endTs + 1).getHours()).toBe(0);
    expect(Math.round((endTs + 1 - startTs) / 86_400_000)).toBe(31);
  });
});

describe('dateValueToEndOfDayMillis', () => {
  it('should return the last millisecond of the picked day', () => {
    const day = millisToDateValue(new Date(2026, 9, 15, 13, 45).getTime());
    if (!day) {
      throw new Error('Expected a calendar date');
    }
    const endTs = dateValueToEndOfDayMillis(day);
    const end = new Date(endTs);

    expect(end.toDateString()).toBe(new Date(2026, 9, 15).toDateString());
    expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([
      23, 59, 59,
    ]);
    expect(new Date(endTs + 1).getDate()).toBe(16);
  });
});

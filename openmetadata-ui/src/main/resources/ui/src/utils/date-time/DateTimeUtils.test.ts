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
import {
  customFormatDateTime,
  formatDate,
  formatDateTime,
  formatDateTimeFromSeconds,
  formatDateTimeLong,
  formatDateTimeWithTimezone,
  formatTimeDurationFromSeconds,
  getTimeZone,
} from './DateTimeUtils';

// jest.mock('luxon', () => ({
//   ...jest.requireActual('luxon'),
//   DateTime: {
//     ...jest.requireActual('luxon').DateTime,
//     now: jest.fn().mockImplementation(() => 0),
//   },
// }));

describe('DateTimeUtils tests', () => {
  it(`formatDateTime should formate date and time both`, () => {
    expect(formatDateTime(0)).toBe(`Jan 1, 1970, 5:30 AM`);
  });

  it(`formatDate should formate date and time both`, () => {
    expect(formatDate(0)).toBe(`Jan 1, 1970`);
  });

  it(`formatDateTimeFromSeconds should formate date and time both`, () => {
    expect(formatDateTimeFromSeconds(0)).toBe(`Jan 1, 1970, 5:30 AM`);
  });

  it(`formatDateShort should formate date and time both`, () => {
    expect(formatDateTimeLong(0)).toBe(`Thu 1th January, 1970,05:30 AM`);
  });

  it(`getTimeZone should formate date and time both`, () => {
    expect(getTimeZone()).toBe(`IST`);
  });

  it(`formatDateTimeWithTimezone should formate date and time both`, () => {
    expect(formatDateTimeWithTimezone(0)).toBe(
      `January 1, 1970, 5:30 AM GMT+5:30`
    );
  });

  it(`formatTimeDurationFromSeconds should formate date and time both`, () => {
    expect(formatTimeDurationFromSeconds(60)).toBe(`00:01:00`);
  });

  it(`customFormatDateTime should formate date and time both`, () => {
    expect(customFormatDateTime(0, 'yyyy/MM/dd')).toBe(`1970/01/01`);
  });
});

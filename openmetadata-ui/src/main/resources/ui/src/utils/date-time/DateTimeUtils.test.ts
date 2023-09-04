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
import { Settings } from 'luxon';
import {
  customFormatDateTime,
  formatDate,
  formatDateTime,
  formatDateTimeFromSeconds,
  formatDateTimeLong,
  formatTimeDurationFromSeconds,
} from './DateTimeUtils';

const systemLocale = Settings.defaultLocale;
const systemZoneName = Settings.defaultZone;

describe('DateTimeUtils tests', () => {
  beforeAll(() => {
    // Explicitly set locale and time zone to make sure date time manipulations and literal
    // results are consistent regardless of where tests are run
    Settings.defaultLocale = 'en-US';
    Settings.defaultZone = 'UTC';
    Date;
  });

  afterAll(() => {
    // Restore locale and time zone
    Settings.defaultLocale = systemLocale;
    Settings.defaultZone = systemZoneName;
  });

  it(`formatDateTime should formate date and time both`, () => {
    expect(formatDateTime(0)).toBe(`Jan 1, 1970, 12:00 AM`);
  });

  it(`formatDate should formate date and time both`, () => {
    expect(formatDate(0)).toBe(`Jan 1, 1970`);
  });

  it(`formatDateTimeFromSeconds should formate date and time both`, () => {
    expect(formatDateTimeFromSeconds(0)).toBe(`Jan 1, 1970, 12:00 AM`);
  });

  it(`formatDateShort should formate date and time both`, () => {
    expect(formatDateTimeLong(0)).toBe(`Thu 1th January, 1970, 12:00 AM`);
  });

  it(`formatTimeDurationFromSeconds should formate date and time both`, () => {
    expect(formatTimeDurationFromSeconds(60)).toBe(`00:01:00`);
  });

  it(`customFormatDateTime should formate date and time both`, () => {
    expect(customFormatDateTime(0, 'yyyy/MM/dd')).toBe(`1970/01/01`);
  });
});

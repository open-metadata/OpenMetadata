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
  calculateInterval,
  convertMillisecondsToHumanReadableFormat,
  convertSecondsToHumanReadableFormat,
  customFormatDateTime,
  DATE_TIME_12_HOUR_FORMAT,
  getActiveTimeFormat,
  getMappedTimeFormat,
  DATE_TIME_WITH_OFFSET_FORMAT,
  DATE_TIME_WEEKDAY_WITH_ORDINAL,
  DATE_TIME_WITH_OFFSET_SHORT,
  formatDate,
  formatDateTime,
  formatDateTimeLong,
  formatDurationToHHMMSS,
  formatMonth,
  formatTimeDurationFromSeconds,
  getScheduleDescriptionTexts,
  isValidDateFormat,
} from './DateTimeUtils';

// ✅ CORRECTED MOCKS: Provide default return values so destructuring doesn't fail
jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: {
    getState: jest.fn().mockReturnValue({
      currentUser: null,
      timeFormat: undefined,
    }),
  },
}));

jest.mock('../../hooks/currentUserStore/useCurrentUserStore', () => ({
  usePersistentStorage: {
    getState: jest.fn().mockReturnValue({
      preferences: {},
    }),
  },
}));

import { useApplicationStore } from '../../hooks/useApplicationStore';
import { usePersistentStorage } from '../../hooks/currentUserStore/useCurrentUserStore';

const systemLocale = Settings.defaultLocale;
const systemZoneName = Settings.defaultZone;

describe('DateTimeUtils tests', () => {
  beforeAll(() => {
    // Explicitly set locale and time zone to make sure date time manipulations and literal
    // results are consistent regardless of where tests are run
    Settings.defaultLocale = 'en-US';
    Settings.defaultZone = 'UTC';
  });

  afterAll(() => {
    // Restore locale and time zone
    Settings.defaultLocale = systemLocale;
    Settings.defaultZone = systemZoneName;
  });

  it(`formatDateTime should format date and time with UTC offset by default`, () => {
    expect(formatDateTime(0)).toBe(`Jan 01, 1970, 12:00 AM (UTC+00:00)`);
  });

  it(`formatDate should formate date and time both`, () => {
    expect(formatDate(0)).toBe(`Jan 1, 1970`);
  });

  it(`formatMonth should format only the month`, () => {
    expect(formatMonth(0)).toBe(`Jan`); // January 1970
    expect(formatMonth(1677628800000)).toBe(`Mar`); // March 2023
    expect(formatMonth(1704067200000)).toBe(`Jan`); // January 2024
    expect(formatMonth(1717200000000)).toBe(`Jun`); // June 2024
  });

  it(`formatMonth should handle null/undefined values`, () => {
    expect(formatMonth(undefined)).toBe('');
    expect(formatMonth(NaN)).toBe('');
  });

  it(`formatDateShort should formate date and time both`, () => {
    expect(formatDateTimeLong(0)).toBe(`January 01, 1970, 12:00 AM (UTC+00:00)`);
  });

  it(`formatTimeDurationFromSeconds should formate date and time both`, () => {
    expect(formatTimeDurationFromSeconds(60)).toBe(`00:01:00`);
  });

  it(`formatDurationToHHMMSS should show milliseconds for short runs`, () => {
    expect(formatDurationToHHMMSS(0)).toBe('00:00:00');
    expect(formatDurationToHHMMSS(210)).toBe('210 ms');
    expect(formatDurationToHHMMSS(999.6)).toBe('999 ms');
    expect(formatDurationToHHMMSS(1000)).toBe('00:00:01');
  });

  it(`customFormatDateTime should formate date and time both`, () => {
    expect(customFormatDateTime(0, 'yyyy/MM/dd')).toBe(`1970/01/01`);
    expect(customFormatDateTime(0, DATE_TIME_12_HOUR_FORMAT)).toBe(
      `Jan 01, 1970, 12:00 AM`
    );
  });
});

describe('Date and DateTime Format Validation', () => {
  it('isValidDateFormat should validate date format correctly', () => {
    expect(isValidDateFormat('yyyy-MM-dd')).toBe(true);
    expect(isValidDateFormat('dd-MM-yyyy')).toBe(true);
    expect(isValidDateFormat('MM/dd/yyyy')).toBe(true);
    expect(isValidDateFormat('dd/MM/yyyy')).toBe(true);
    expect(isValidDateFormat('yyyy/MM/dd')).toBe(true);
    expect(isValidDateFormat('invalid-format')).toBe(false);
  });

  it('isValidDateFormat should validate dateTime format correctly', () => {
    expect(isValidDateFormat('yyyy-MM-dd HH:mm:ss')).toBe(true);
    expect(isValidDateFormat('dd-MM-yyyy HH:mm:ss')).toBe(true);
    expect(isValidDateFormat('MM/dd/yyyy HH:mm:ss')).toBe(true);
    expect(isValidDateFormat('dd/MM/yyyy HH:mm:ss')).toBe(true);
    expect(isValidDateFormat('yyyy/MM/dd HH:mm:ss')).toBe(true);
    expect(isValidDateFormat('invalid-format')).toBe(false);
  });
});

describe('calculateInterval', () => {
  it('should return "0 Days, 0 Hours" for the same start and end time', () => {
    const startTime = 1710831125922;
    const endTime = 1710831125922;
    const result = calculateInterval(startTime, endTime);
    expect(result).toBe('0 Days, 0 Hours');
  });

  it('should return "0 Days, 0 Hours" for a small interval', () => {
    const startTime = 1710831125922;
    const endTime = 1710831125924;
    const result = calculateInterval(startTime, endTime);
    expect(result).toBe('0 Days, 0 Hours');
  });

  it('should return "1 Days, 0 Hours" for a 24-hour interval', () => {
    const startTime = 1710831125922;
    const endTime = startTime + 24 * 60 * 60 * 1000; // 24 hours later
    const result = calculateInterval(startTime, endTime);
    expect(result).toBe('1 Days, 0 Hours');
  });

  it('should return "2 Days, 8 Hours" for a 56-hour interval', () => {
    const startTime = 1710831125922;
    const endTime = startTime + 56 * 60 * 60 * 1000; // 56 hours later
    const result = calculateInterval(startTime, endTime);
    expect(result).toBe('2 Days, 8 Hours');
  });

  it('should handle invalid timestamps gracefully', () => {
    const startTime = NaN;
    const endTime = NaN;
    const result = calculateInterval(startTime, endTime);
    expect(result).toBe('Invalid interval');
  });

  it('should return correct interval when start and end time are in seconds', () => {
    const startTimeInSeconds = 1710831125;
    const endTimeInSeconds = startTimeInSeconds + 56 * 60 * 60; // 56 hours later
    const result = calculateInterval(startTimeInSeconds, endTimeInSeconds);
    expect(result).toBe('0 Days, 0 Hours');
  });
});

describe('convertMillisecondsToHumanReadableFormat', () => {
  const testCases = [
    { input: 0, expected: '0s' },
    { input: 1000, expected: '1s' },
    { input: 60000, expected: '1m' },
    { input: 3600020, expected: '1h' },
    { input: 7265000, expected: '2h 1m 5s' },
    { input: 59999, expected: '59s' },
    { input: 61000, expected: '1m 1s' },
    { input: 3661000, expected: '1h 1m 1s' },
    { input: 86400000, expected: '1d' },
    { input: 90061000, expected: '1d 1h 1m 1s' },
    { input: -1000, expected: '-1s' },
    { input: 1200, expected: '1s 200ms', showMilliseconds: true },
    {
      input: 90061560,
      expected: '1d 1h 1m 1s 560ms',
      length: 5,
      showMilliseconds: true,
    },
    { input: 90061560, expected: '1d 1h', length: 2, showMilliseconds: true },
    { input: -61000, expected: '-1m 1s' },
    {
      input: -3661000,
      expected: 'Late by 1h 1m 1s',
      prependForNegativeValue: 'Late by ',
    },
    { input: -86400000, expected: '-1d' },
    {
      input: -90061000,
      expected: 'Late by 1d 1h 1m 1s',
      prependForNegativeValue: 'Late by ',
    },
  ];

  testCases.forEach(
    ({ input, expected, length, showMilliseconds, prependForNegativeValue }) => {
      it(`should return "${expected}" for ${input} milliseconds`, () => {
        expect(
          convertMillisecondsToHumanReadableFormat(
            input,
            length,
            showMilliseconds,
            prependForNegativeValue
          )
        ).toBe(expected);
      });
    }
  );

  const testCasesWithLength = [
    {
      input: 7265000,
      expected: '2h 1m 5s',
      expectedWithLength: '2h 1m',
      length: 2,
    },
    {
      input: 3661000,
      expected: '1h 1m 1s',
      expectedWithLength: '1h',
      length: 1,
    },
    {
      input: 90061000,
      expected: '1d 1h 1m 1s',
      expectedWithLength: '1d 1h 1m',
      length: 3,
    },
    { input: 3600000, expected: '1h', expectedWithLength: '1h', length: 4 }, // length > number of parts
  ];

  testCasesWithLength.forEach(({ input, expected, expectedWithLength, length }) => {
    it(`should return "${expected}" for ${input} milliseconds`, () => {
      expect(convertMillisecondsToHumanReadableFormat(input)).toBe(expected);
      expect(convertMillisecondsToHumanReadableFormat(input, length)).toBe(
        expectedWithLength
      );
    });
  });

  it('should return the correct value for the input value', () => {
    const inputValue = 224813364.39; // input in seconds
    const result = convertMillisecondsToHumanReadableFormat(inputValue * 1000);
    expect(result).toContain('7Y');
    expect(result).toContain('M');
    expect(result).toContain('d');
    expect(result).toContain('24s'); // Should end with 24s
  });
});

describe('convertSecondsToHumanReadableFormat', () => {
  describe('Basic functionality', () => {
    const basicTestCases = [
      { input: 0, expected: '0s', description: 'zero seconds' },
      { input: 1, expected: '1s', description: '1 second' },
      { input: 60, expected: '1m', description: '1 minute' },
      { input: 3600, expected: '1h', description: '1 hour' },
      { input: 86400, expected: '1d', description: '1 day' },
      { input: 2592000, expected: '1M', description: '1 month (30 days)' },
      {
        input: 31104000,
        expected: '1Y',
        description: '1 year (360 days: 12 months x 30 days)',
      },
    ];

    basicTestCases.forEach(({ input, expected, description }) => {
      it(`should return "${expected}" for ${description} (${input}s)`, () => {
        expect(convertSecondsToHumanReadableFormat(input)).toBe(expected);
      });
    });
  });

  describe('Negative values (freshness late by)', () => {
    const negativeTestCases = [
      { input: -1, expected: '-1s' },
      { input: -60, expected: '-1m' },
      { input: -3600, expected: '-1h' },
      { input: -86400, expected: '-1d' },
      { input: -3661, expected: '-1h 1m 1s' },
      {
        input: -86400,
        expected: 'late by 1d',
        prependForNegativeValue: 'late by ',
      },
      {
        input: -3661,
        expected: 'late by 1h 1m 1s',
        prependForNegativeValue: 'late by ',
      },
    ];

    negativeTestCases.forEach(({ input, expected, prependForNegativeValue }) => {
      it(`should return "${expected}" for ${input} seconds`, () => {
        expect(
          convertSecondsToHumanReadableFormat(
            input,
            undefined,
            prependForNegativeValue
          )
        ).toBe(expected);
      });
    });
  });

  describe('Combined time units', () => {
    const combinedTestCases = [
      { input: 61, expected: '1m 1s', description: '1 minute 1 second' },
      {
        input: 3661,
        expected: '1h 1m 1s',
        description: '1 hour 1 minute 1 second',
      },
      {
        input: 90061,
        expected: '1d 1h 1m 1s',
        description: '1 day 1 hour 1 minute 1 second',
      },
      {
        input: 7265,
        expected: '2h 1m 5s',
        description: '2 hours 1 minute 5 seconds',
      },
      {
        input: 2678461,
        expected: '1M 1d 1m 1s',
        description: 'approximately 1 month 1 day with minutes and seconds',
      },
      {
        input: 34249261,
        expected: '1Y 1M 6d 9h 41m 1s',
        description: 'approximately 1 year 1 month 1 day',
      },
    ];

    combinedTestCases.forEach(({ input, expected, description }) => {
      it(`should return "${expected}" for ${description}`, () => {
        expect(convertSecondsToHumanReadableFormat(input)).toBe(expected);
      });
    });
  });

  describe('Length parameter (truncate output)', () => {
    const lengthTestCases = [
      { input: 90061, length: 1, expected: '1d' },
      { input: 90061, length: 2, expected: '1d 1h' },
      { input: 90061, length: 3, expected: '1d 1h 1m' },
      { input: 90061, length: 4, expected: '1d 1h 1m 1s' },
      { input: 7265, length: 2, expected: '2h 1m' },
      { input: 34249261, length: 3, expected: '1Y 1M 6d' },
    ];

    lengthTestCases.forEach(({ input, length, expected }) => {
      it(`should return "${expected}" for ${input}s with length=${length}`, () => {
        expect(convertSecondsToHumanReadableFormat(input, length)).toBe(expected);
      });
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle exactly 1 year (360 days: 12 months × 30 days)', () => {
      const oneYear = 12 * 30 * 24 * 3600; // 31,104,000 seconds
      expect(convertSecondsToHumanReadableFormat(oneYear)).toBe('1Y');
    });

    it('should handle exactly 1 month (30 days)', () => {
      const oneMonth = 30 * 24 * 3600; // 2,592,000 seconds
      expect(convertSecondsToHumanReadableFormat(oneMonth)).toBe('1M');
    });

    it('should handle 12 months and show as 1 year', () => {
      const twelveMonths = 12 * 30 * 24 * 3600; // 31,104,000 seconds
      const result = convertSecondsToHumanReadableFormat(twelveMonths);
      expect(result).toBe('1Y');
    });

    it('should handle 13 months correctly', () => {
      const thirteenMonths = 13 * 30 * 24 * 3600; // 33,696,000 seconds
      const result = convertSecondsToHumanReadableFormat(thirteenMonths);
      expect(result).toBe('1Y 1M');
    });

    it('should handle very small positive values', () => {
      expect(convertSecondsToHumanReadableFormat(0.5)).toBe('0s');
      expect(convertSecondsToHumanReadableFormat(0.9)).toBe('0s');
    });

    it('should handle very large values', () => {
      const tenYears = 10 * 12 * 30 * 24 * 3600; // 311,040,000 seconds (10 years × 360 days)
      expect(convertSecondsToHumanReadableFormat(tenYears)).toBe('10Y');
    });
  });

  describe('Production data test cases (actual freshness values)', () => {
    const productionTestCases = [
      {
        input: -33835208,
        expectedDays: 391.6,
        expectedOutput: 'late by 1Y 1M 1d 14h 40m 8s',
        description: 'Value #1 from test.ts (391.6 days)',
      },
      {
        input: -33748802,
        expectedDays: 390.6,
        expectedOutput: 'late by 1Y 1M 14h 40m 2s',
        description: 'Value #2 from test.ts (390.6 days)',
      },
      {
        input: -31588801,
        expectedDays: 365.6,
        expectedOutput: 'late by 1Y 5d 14h 40m 1s',
        description: 'Value #27: 365.6 days (5.6 days past 360-day year)',
      },
      {
        input: -31502412,
        expectedDays: 364.6,
        expectedOutput: 'late by 1Y 4d 14h 40m 12s',
        description: 'Value #28: 364.6 days (4.6 days past 360-day year)',
      },
      {
        input: -31416002,
        expectedDays: 363.6,
        expectedOutput: 'late by 1Y 3d 14h 40m 2s',
        description: 'Value #29: 363.6 days (3.6 days past 360-day year)',
      },
      {
        input: -31329605,
        expectedDays: 362.6,
        expectedOutput: 'late by 1Y 2d 14h 40m 5s',
        description: 'Value #30: 362.6 days - original bug report showing as "2d 14h"',
      },
    ];

    productionTestCases.forEach(({ input, expectedDays, expectedOutput, description }) => {
      it(`should correctly format ${description} (${expectedDays} days)`, () => {
        const result = convertSecondsToHumanReadableFormat(
          input,
          undefined,
          'late by '
        );
        expect(result).toBe(expectedOutput);
        expect(result).not.toContain('12M');
        const dayMatch = result.match(/(\d+)d/);
        if (dayMatch) {
          const days = parseInt(dayMatch[1]);
          expect(days).toBeLessThanOrEqual(30);
        }
      });
    });
  });

  describe('Validation: months and days stay within bounds', () => {
    const validationTestCases = [
      { seconds: -32280001, days: 373.6 },
      { seconds: -32193603, days: 372.6 },
      { seconds: -32107200, days: 371.6 },
      { seconds: -31934399, days: 369.6 },
      { seconds: -31847998, days: 368.6 },
      { seconds: -31761665, days: 367.6 },
      { seconds: -31675203, days: 366.6 },
    ];

    validationTestCases.forEach(({ seconds, days }) => {
      it(`should keep months < 12 and days <= 30 for ${days} days`, () => {
        const result = convertSecondsToHumanReadableFormat(
          seconds,
          undefined,
          'late by '
        );
        const monthMatch = result.match(/(\d+)M/);
        if (monthMatch) {
          const months = parseInt(monthMatch[1]);
          expect(months).toBeLessThan(12);
        }
        const dayMatch = result.match(/(\d+)d/);
        if (dayMatch) {
          const daysValue = parseInt(dayMatch[1]);
          expect(daysValue).toBeLessThanOrEqual(30);
        }
        expect(result).toContain('1Y');
      });
    });
  });

  describe('Comparison with original buggy behavior', () => {
    it('should NOT lose days like the original modulo bug', () => {
      const seconds = -31329605; // 362.6 days
      const result = convertSecondsToHumanReadableFormat(
        seconds,
        undefined,
        'late by '
      );
      expect(result).toContain('1Y');
      expect(result).toContain('2d');
      expect(result).not.toBe('late by 2d 14h');
    });

    it('should show consistent years based on 360-day year', () => {
      const seconds = -31502412; // 364.6 days
      const result = convertSecondsToHumanReadableFormat(
        seconds,
        undefined,
        'late by '
      );
      expect(result).toContain('1Y');
      expect(result).toContain('4d');
    });
  });

  describe('Custom prepend string for negative values', () => {
    const customPrependTestCases = [
      {
        input: -3600,
        prepend: 'Overdue by ',
        expected: 'Overdue by 1h',
      },
      {
        input: -86400,
        prepend: 'Stale for ',
        expected: 'Stale for 1d',
      },
      {
        input: -3661,
        prepend: '',
        expected: '1h 1m 1s',
      },
    ];

    customPrependTestCases.forEach(({ input, prepend, expected }) => {
      it(`should use custom prepend "${prepend}" for negative values`, () => {
        expect(
          convertSecondsToHumanReadableFormat(input, undefined, prepend)
        ).toBe(expected);
      });
    });
  });

  describe('Consistency with fixed time units', () => {
    it('should use 360 days per year (12 months × 30 days)', () => {
      const oneYear = 12 * 30 * 24 * 3600; // 31,104,000 seconds
      expect(convertSecondsToHumanReadableFormat(oneYear)).toBe('1Y');
    });

    it('should use 30 days per month', () => {
      const oneMonth = 30 * 24 * 3600; // 2,592,000 seconds
      expect(convertSecondsToHumanReadableFormat(oneMonth)).toBe('1M');
    });

    it('should maintain consistency across different inputs', () => {
      expect(convertSecondsToHumanReadableFormat(86400 * 30)).toBe('1M');
      expect(convertSecondsToHumanReadableFormat(86400 * 60)).toBe('2M');
      expect(convertSecondsToHumanReadableFormat(86400 * 360)).toBe('1Y');
    });
  });

  describe('Monotonic ordering validation', () => {
    it('should show increasing time values for consecutive dates (Nov 15-30 scenario)', () => {
      const consecutiveDateScenarios = [
        { date: 'Nov 30', seconds: -31104000, days: 360.0 },
        { date: 'Nov 29', seconds: -31190400, days: 361.0 },
        { date: 'Nov 28', seconds: -31276800, days: 362.0 },
        { date: 'Nov 27', seconds: -31329605, days: 362.6 },
        { date: 'Nov 26', seconds: -31363200, days: 363.0 },
        { date: 'Nov 25', seconds: -31416002, days: 363.6 },
        { date: 'Nov 24', seconds: -31449600, days: 364.0 },
        { date: 'Nov 23', seconds: -31502399, days: 364.6 },
        { date: 'Nov 22', seconds: -31536000, days: 365.0 },
        { date: 'Nov 21', seconds: -31588801, days: 365.6 },
        { date: 'Nov 20', seconds: -31622400, days: 366.0 },
        { date: 'Nov 19', seconds: -31675203, days: 366.6 },
        { date: 'Nov 18', seconds: -31708800, days: 367.0 },
        { date: 'Nov 17', seconds: -31761600, days: 367.6 },
        { date: 'Nov 16', seconds: -31795200, days: 368.0 },
        { date: 'Nov 15', seconds: -31848002, days: 368.6 },
      ];

      const formattedResults = consecutiveDateScenarios.map((scenario) => ({
        ...scenario,
        formatted: convertSecondsToHumanReadableFormat(
          scenario.seconds,
          undefined,
          'late by '
        ),
      }));

      for (let i = 0; i < formattedResults.length - 1; i++) {
        const current = formattedResults[i];
        const next = formattedResults[i + 1];
        expect(Math.abs(current.seconds)).toBeLessThan(Math.abs(next.seconds));
        expect(current.formatted).not.toBe(next.formatted);
      }

      const nov27 = formattedResults.find(
        (r) => r.days === 362.6
      ) as (typeof formattedResults)[number];
      const nov19 = formattedResults.find(
        (r) => r.days === 366.6
      ) as (typeof formattedResults)[number];
      expect(Math.abs(nov27.seconds)).toBeLessThan(Math.abs(nov19.seconds));
      expect(formattedResults).toHaveLength(16);
    });

    it('should maintain strict monotonic ordering across a range of values', () => {
      const testValues = [
        -31104000, -31190400, -31276800, -31363200, -31449600,
        -31536000, -31622400, -31708800, -31795200, -31881600, -31968000,
      ];

      const formattedValues = testValues.map((seconds) =>
        convertSecondsToHumanReadableFormat(seconds, undefined, 'late by ')
      );

      const uniqueFormatted = new Set(formattedValues);
      expect(uniqueFormatted.size).toBe(testValues.length);

      for (let i = 0; i < testValues.length - 1; i++) {
        expect(Math.abs(testValues[i])).toBeLessThan(Math.abs(testValues[i + 1]));
        expect(formattedValues[i]).not.toBe(formattedValues[i + 1]);
      }
    });

    it('should handle edge cases around year boundaries correctly', () => {
      const edgeCases = [
        { seconds: -31017600, description: '359 days (1d before 1 year)' },
        { seconds: -31104000, description: '360 days (exactly 1 year)' },
        { seconds: -31190400, description: '361 days (1d after 1 year)' },
        { seconds: -33696000, description: '390 days (1Y 1M)' },
        { seconds: -34560000, description: '400 days (1Y 1M 10d)' },
      ];

      const results = edgeCases.map((testCase) => ({
        ...testCase,
        formatted: convertSecondsToHumanReadableFormat(
          testCase.seconds,
          undefined,
          'late by '
        ),
      }));

      for (let i = 0; i < results.length - 1; i++) {
        expect(Math.abs(results[i].seconds)).toBeLessThan(Math.abs(results[i + 1].seconds));
        expect(results[i].formatted).not.toBe(results[i + 1].formatted);
      }

      const day361 = results.find((r) =>
        r.description.includes('361 days')
      ) as (typeof results)[number];
      expect(day361.formatted).toContain('1Y');
      expect(day361.formatted).toContain('1d');
    });
  });
});

describe('getScheduleDescriptionTexts', () => {
  it('should parse daily cron schedule correctly', () => {
    const result = getScheduleDescriptionTexts('0 0 * * *');
    expect(result).toHaveProperty('descriptionFirstPart');
    expect(result).toHaveProperty('descriptionSecondPart');
    expect(typeof result.descriptionFirstPart).toBe('string');
    expect(typeof result.descriptionSecondPart).toBe('string');
  });

  it('should parse hourly cron schedule correctly', () => {
    const result = getScheduleDescriptionTexts('0 * * * *');
    expect(result).toHaveProperty('descriptionFirstPart');
    expect(result).toHaveProperty('descriptionSecondPart');
    expect(typeof result.descriptionFirstPart).toBe('string');
    expect(typeof result.descriptionSecondPart).toBe('string');
  });

  it('should parse weekly cron schedule correctly', () => {
    const result = getScheduleDescriptionTexts('0 0 * * 1');
    expect(result).toHaveProperty('descriptionFirstPart');
    expect(result).toHaveProperty('descriptionSecondPart');
    expect(typeof result.descriptionFirstPart).toBe('string');
    expect(typeof result.descriptionSecondPart).toBe('string');
  });

  it('should parse custom interval cron schedule correctly', () => {
    const result = getScheduleDescriptionTexts('*/15 * * * *');
    expect(result).toHaveProperty('descriptionFirstPart');
    expect(result).toHaveProperty('descriptionSecondPart');
    expect(typeof result.descriptionFirstPart).toBe('string');
    expect(typeof result.descriptionSecondPart).toBe('string');
  });

  it('should handle invalid cron expression gracefully', () => {
    const result = getScheduleDescriptionTexts('invalid cron');
    expect(result.descriptionFirstPart).toBe('');
    expect(result.descriptionSecondPart).toBe('');
  });

  it('should handle empty string gracefully', () => {
    const result = getScheduleDescriptionTexts('');
    expect(result.descriptionFirstPart).toBe('');
    expect(result.descriptionSecondPart).toBe('');
  });

  it('should return consistent structure for valid cron expressions', () => {
    const result1 = getScheduleDescriptionTexts('0 12 * * *');
    const result2 = getScheduleDescriptionTexts('30 8 * * 1-5');
    expect(result1).toHaveProperty('descriptionFirstPart');
    expect(result1).toHaveProperty('descriptionSecondPart');
    expect(result2).toHaveProperty('descriptionFirstPart');
    expect(result2).toHaveProperty('descriptionSecondPart');
    expect(typeof result1.descriptionFirstPart).toBe('string');
    expect(typeof result1.descriptionSecondPart).toBe('string');
    expect(typeof result2.descriptionFirstPart).toBe('string');
    expect(typeof result2.descriptionSecondPart).toBe('string');
  });
});

describe('DateTimeUtils', () => {
  describe('getMappedTimeFormat', () => {
    const testCases = [
      {
        name: 'maps DATE_TIME_12_HOUR_FORMAT to 24h',
        input: DATE_TIME_12_HOUR_FORMAT,
        timeFormat: '24h' as const,
        expected: 'MMM dd, yyyy, HH:mm',
      },
      {
        name: 'maps DATE_TIME_WITH_OFFSET_FORMAT to 24h',
        input: DATE_TIME_WITH_OFFSET_FORMAT,
        timeFormat: '24h' as const,
        expected: "MMMM dd, yyyy, H:mm '(UTC'ZZ')'",
      },
      {
        name: 'maps DATE_TIME_WEEKDAY_WITH_ORDINAL to 24h',
        input: DATE_TIME_WEEKDAY_WITH_ORDINAL,
        timeFormat: '24h' as const,
        expected: "ccc d'th' MMMM, yyyy, HH:mm",
      },
      {
        name: 'maps DATE_TIME_WITH_OFFSET_SHORT to 24h',
        input: DATE_TIME_WITH_OFFSET_SHORT,
        timeFormat: '24h' as const,
        expected: "MMM dd, yyyy, HH:mm '(UTC'ZZ')'",
      },
      {
        name: 'maps DATE_TIME_12_HOUR_FORMAT to 12h (unchanged)',
        input: DATE_TIME_12_HOUR_FORMAT,
        timeFormat: '12h' as const,
        expected: DATE_TIME_12_HOUR_FORMAT,
      },
      {
        name: 'does not incorrectly map 12h format with seconds',
        input: 'hh:mm:ss a',
        timeFormat: '24h' as const,
        expected: 'hh:mm:ss a',
      },
      {
        name: 'does not incorrectly map 24h format with seconds (HH:mm:ss)',
        input: 'HH:mm:ss',
        timeFormat: '12h' as const,
        expected: 'HH:mm:ss',
      },
      {
        name: 'does not incorrectly map 24h format with seconds in full datetime',
        input: 'yyyy-MM-dd HH:mm:ss',
        timeFormat: '12h' as const,
        expected: 'yyyy-MM-dd HH:mm:ss',
      },
      {
        name: 'leaves date-only formats unchanged (24h)',
        input: 'yyyy-MM-dd',
        timeFormat: '24h' as const,
        expected: 'yyyy-MM-dd',
      },
      {
        name: 'leaves date-only formats unchanged (12h)',
        input: 'yyyy-MM-dd',
        timeFormat: '12h' as const,
        expected: 'yyyy-MM-dd',
      },
    ];

    testCases.forEach(({ name, input, timeFormat, expected }) => {
      it(name, () => {
        expect(getMappedTimeFormat(input, timeFormat)).toBe(expected);
      });
    });
  });

  describe('getActiveTimeFormat', () => {
    const mockGetAppState = useApplicationStore.getState as jest.Mock;
    const mockGetPersistState = usePersistentStorage.getState as jest.Mock;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testCases = [
      {
        name: 'returns user 24h preference over global 12h preference',
        global: '12h',
        user: '24h',
        expected: '24h',
      },
      {
        name: 'returns user 12h preference over global 24h preference',
        global: '24h',
        user: '12h',
        expected: '12h',
      },
      {
        name: 'returns global 24h preference when user preference is unset',
        global: '24h',
        user: undefined,
        expected: '24h',
      },
      {
        name: 'returns global 12h preference when user preference is unset',
        global: '12h',
        user: undefined,
        expected: '12h',
      },
      {
        name: 'returns 12h default when neither user nor global is set',
        global: undefined,
        user: undefined,
        expected: '12h',
      },
    ];

    testCases.forEach(({ name, global, user, expected }) => {
      it(name, () => {
        mockGetAppState.mockReturnValue({
          currentUser: { name: 'testUser' },
          timeFormat: global,
        });
        mockGetPersistState.mockReturnValue({
          preferences: {
            testUser: user ? { timeFormat: user } : {},
          },
        });

        expect(getActiveTimeFormat()).toBe(expected as '12h' | '24h');
      });
    });
  });
});
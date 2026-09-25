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
import { DateTime } from 'luxon';
import {
  formatDurationText,
  fromDateTimeParts,
  getPresetRange,
  getZoneLabel,
  getTimeIntervalProgress,
  mergeManualInterval,
  resolveEditedInterval,
  toDateTimeParts,
} from './TimeIntervalPropertyValue.utils';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('TimeIntervalPropertyValue.utils', () => {
  describe('getTimeIntervalProgress', () => {
    const start = Date.UTC(2026, 8, 24, 0, 0);
    const end = start + 2 * DAY;

    it('reports an ongoing interval with elapsed and remaining time', () => {
      expect(getTimeIntervalProgress(start, end, start + DAY / 2)).toEqual({
        status: 'ongoing',
        progress: 0.25,
        totalMs: 2 * DAY,
        elapsedMs: DAY / 2,
        remainingMs: 1.5 * DAY,
      });
    });

    it('reports an upcoming interval with nothing elapsed', () => {
      const result = getTimeIntervalProgress(start, end, start - HOUR);

      expect(result.status).toBe('upcoming');
      expect(result.progress).toBe(0);
      expect(result.remainingMs).toBe(2 * DAY);
    });

    it('reports an ended interval as fully elapsed', () => {
      const result = getTimeIntervalProgress(start, end, end + HOUR);

      expect(result.status).toBe('ended');
      expect(result.progress).toBe(1);
      expect(result.remainingMs).toBe(0);
    });

    it('handles a zero-length interval', () => {
      expect(getTimeIntervalProgress(start, start, start + 1).progress).toBe(1);
    });
  });

  describe('formatDurationText', () => {
    it('keeps the two largest non-zero units', () => {
      expect(formatDurationText(2 * DAY + 14 * HOUR + 5 * 60000, 'en')).toBe(
        '2 days, 14 hours'
      );
    });

    it('skips zero units', () => {
      expect(formatDurationText(DAY + 30 * 60000, 'en')).toBe(
        '1 day, 30 minutes'
      );
    });

    it('renders sub-minute spans as zero minutes', () => {
      expect(formatDurationText(10_000, 'en')).toBe('0 minutes');
    });
  });

  describe('date-time parts', () => {
    it('round-trips through UTC parts', () => {
      const ms = Date.UTC(2026, 8, 24, 1, 57);
      const parts = toDateTimeParts(ms, 'utc');

      expect(parts).toEqual({
        year: 2026,
        month: 9,
        day: 24,
        hour: 1,
        minute: 57,
      });
      expect(fromDateTimeParts(parts, 'utc')).toBe(ms);
    });
  });

  describe('getPresetRange', () => {
    const now = Date.UTC(2026, 8, 25, 13, 57);

    it('covers today from midnight to the last minute', () => {
      const { start, end } = getPresetRange('today', now, 'utc');

      expect(DateTime.fromMillis(start, { zone: 'utc' }).toISO()).toBe(
        '2026-09-25T00:00:00.000Z'
      );
      expect(DateTime.fromMillis(end, { zone: 'utc' }).toISO()).toBe(
        '2026-09-25T23:59:00.000Z'
      );
    });

    it('covers the last 7 days including today', () => {
      const { start } = getPresetRange('last7Days', now, 'utc');

      expect(DateTime.fromMillis(start, { zone: 'utc' }).toISODate()).toBe(
        '2026-09-19'
      );
    });

    it('covers the whole current month', () => {
      const { start, end } = getPresetRange('thisMonth', now, 'utc');

      expect(DateTime.fromMillis(start, { zone: 'utc' }).toISODate()).toBe(
        '2026-09-01'
      );
      expect(DateTime.fromMillis(end, { zone: 'utc' }).toISODate()).toBe(
        '2026-09-30'
      );
    });
  });

  describe('resolveEditedInterval', () => {
    it('clears the value when both bounds are blank', () => {
      expect(resolveEditedInterval({ start: '', end: ' ' })).toEqual({
        isValid: true,
      });
    });

    it('requires both bounds', () => {
      expect(resolveEditedInterval(undefined, 1)).toEqual({
        isValid: false,
        errorKey: 'message.time-interval-start-and-end-required',
      });
    });

    it('rejects manual text that is not epoch milliseconds', () => {
      expect(
        resolveEditedInterval({ start: '1790195220000', end: 'tomorrow' })
      ).toEqual({
        isValid: false,
        errorKey: 'message.invalid-unix-epoch-time-milliseconds',
      });
    });

    it('rejects an end before the start', () => {
      expect(resolveEditedInterval(undefined, 20, 10)).toEqual({
        isValid: false,
        errorKey: 'message.time-interval-end-before-start',
      });
    });

    it('prefers manual bounds over the picked ones', () => {
      expect(
        resolveEditedInterval(
          { start: '1790195220000', end: '1790418420000' },
          1,
          2
        )
      ).toEqual({
        isValid: true,
        value: { start: 1790195220000, end: 1790418420000 },
      });
    });
  });

  describe('mergeManualInterval', () => {
    it('keeps the previous bound when manual text does not parse', () => {
      expect(
        mergeManualInterval({ start: '1790195220000', end: 'bad' }, 1, 2)
      ).toEqual({ start: 1790195220000, end: 2 });
    });
  });

  describe('getZoneLabel', () => {
    it('shows the abbreviation with the offset when one exists', () => {
      expect(getZoneLabel('en-US', 'America/New_York')).toMatch(
        /^E[SD]T \(UTC-[45]\)$/
      );
    });

    it('shows only the offset for zones without a short name', () => {
      expect(getZoneLabel('en-US', 'Asia/Kolkata')).toBe('UTC+5:30');
    });
  });
});

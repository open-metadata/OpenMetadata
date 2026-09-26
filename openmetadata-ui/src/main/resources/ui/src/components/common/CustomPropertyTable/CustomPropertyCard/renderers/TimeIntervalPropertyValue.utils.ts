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
import { DateTime, Duration } from 'luxon';

export type TimeIntervalStatus = 'upcoming' | 'ongoing' | 'ended';

export type TimeIntervalZone = 'local' | 'utc';

export type TimeIntervalPreset =
  | 'today'
  | 'last7Days'
  | 'last30Days'
  | 'thisMonth'
  | 'custom';

export interface TimeIntervalProgress {
  status: TimeIntervalStatus;
  /** Fraction of the interval that has elapsed, clamped to [0, 1]. */
  progress: number;
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
}

export interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const DURATION_UNITS = ['days', 'hours', 'minutes'] as const;
const MAX_DURATION_PARTS = 2;

export const getTimeIntervalProgress = (
  start: number,
  end: number,
  now: number
): TimeIntervalProgress => {
  const totalMs = Math.max(end - start, 0);
  const elapsedMs = Math.min(Math.max(now - start, 0), totalMs);
  let status: TimeIntervalStatus = 'ongoing';
  if (now < start) {
    status = 'upcoming';
  } else if (now > end) {
    status = 'ended';
  }

  return {
    status,
    progress: totalMs ? elapsedMs / totalMs : Number(now >= end),
    totalMs,
    elapsedMs,
    remainingMs: totalMs - elapsedMs,
  };
};

/**
 * Localised "1 day, 12 hours" style text. Keeps the two largest non-zero
 * units so long intervals stay short; sub-minute spans render as 0 minutes.
 */
export const formatDurationText = (ms: number, locale: string): string => {
  const duration = Duration.fromMillis(Math.max(ms, 0))
    .shiftTo(...DURATION_UNITS)
    .toObject();
  const units = DURATION_UNITS.filter(
    (unit) => Math.floor(duration[unit] ?? 0) > 0
  ).slice(0, MAX_DURATION_PARTS);
  const parts = units.length ? units : (['minutes'] as const);

  return Duration.fromObject(
    Object.fromEntries(
      parts.map((unit) => [unit, Math.floor(duration[unit] ?? 0)])
    ),
    { locale }
  ).toHuman({ unitDisplay: 'long' });
};

export const toDateTimeParts = (
  ms: number,
  zone: TimeIntervalZone
): DateTimeParts => {
  const { year, month, day, hour, minute } = DateTime.fromMillis(ms, {
    zone,
  });

  return { year, month, day, hour, minute };
};

export const fromDateTimeParts = (
  parts: DateTimeParts,
  zone: TimeIntervalZone
): number => DateTime.fromObject(parts, { zone }).toMillis();

export const getPresetRange = (
  preset: Exclude<TimeIntervalPreset, 'custom'>,
  now: number,
  zone: TimeIntervalZone
): { start: number; end: number } => {
  const current = DateTime.fromMillis(now, { zone });
  const endOfToday = current.endOf('day').startOf('minute');

  const ranges: Record<
    typeof preset,
    () => { start: DateTime; end: DateTime }
  > = {
    today: () => ({ start: current.startOf('day'), end: endOfToday }),
    last7Days: () => ({
      start: current.minus({ days: 6 }).startOf('day'),
      end: endOfToday,
    }),
    last30Days: () => ({
      start: current.minus({ days: 29 }).startOf('day'),
      end: endOfToday,
    }),
    thisMonth: () => ({
      start: current.startOf('month'),
      end: current.endOf('month').startOf('minute'),
    }),
  };
  const { start, end } = ranges[preset]();

  return { start: start.toMillis(), end: end.toMillis() };
};

export const formatIntervalDate = (
  ms: number,
  zone: TimeIntervalZone,
  locale: string
) =>
  DateTime.fromMillis(ms, { zone })
    .setLocale(locale)
    .toFormat('ccc, d LLL yyyy');

export const formatIntervalTime = (
  ms: number,
  zone: TimeIntervalZone,
  locale: string
) => DateTime.fromMillis(ms, { zone }).setLocale(locale).toFormat('HH:mm ZZZZ');

export const formatIntervalTooltip = (ms: number, locale: string) =>
  `UTC ${DateTime.fromMillis(ms, { zone: 'utc' })
    .setLocale(locale)
    .toFormat('ccc, d LLL yyyy, HH:mm')} · ${ms}`;

const EPOCH_MS_PATTERN = /^\d{13}$/;

/** `undefined` for blank text, `null` for text that is not epoch milliseconds. */
export const parseEpochText = (text: string): number | undefined | null => {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  return EPOCH_MS_PATTERN.test(trimmed) ? Number(trimmed) : null;
};

export type IntervalBoundsResult =
  | { isValid: true; value?: { start: number; end: number } }
  | { isValid: false; errorKey: string };

/** Both bounds blank clears the value; otherwise both are required, in order. */
export const resolveIntervalBounds = (
  start?: number,
  end?: number
): IntervalBoundsResult => {
  if (start === undefined && end === undefined) {
    return { isValid: true };
  }
  if (start === undefined || end === undefined) {
    return {
      isValid: false,
      errorKey: 'message.time-interval-start-and-end-required',
    };
  }
  if (start > end) {
    return {
      isValid: false,
      errorKey: 'message.time-interval-end-before-start',
    };
  }

  return { isValid: true, value: { start, end } };
};

export interface ManualIntervalText {
  start: string;
  end: string;
}

export const toEpochText = (ms?: number) =>
  ms === undefined ? '' : String(ms);

const pickParsed = (text: string, fallback?: number) => {
  const parsed = parseEpochText(text);

  return parsed === null ? fallback : parsed;
};

/** Leaving manual entry keeps every bound that parsed cleanly. */
export const mergeManualInterval = (
  manual: ManualIntervalText,
  start?: number,
  end?: number
) => ({
  start: pickParsed(manual.start, start),
  end: pickParsed(manual.end, end),
});

export const resolveEditedInterval = (
  manual: ManualIntervalText | undefined,
  start?: number,
  end?: number
): IntervalBoundsResult => {
  if (!manual) {
    return resolveIntervalBounds(start, end);
  }
  const manualStart = parseEpochText(manual.start);
  const manualEnd = parseEpochText(manual.end);
  if (manualStart === null || manualEnd === null) {
    return {
      isValid: false,
      errorKey: 'message.invalid-unix-epoch-time-milliseconds',
    };
  }

  return resolveIntervalBounds(manualStart, manualEnd);
};

export const getIntervalDurationMs = (start?: number, end?: number) =>
  start !== undefined && end !== undefined && end >= start
    ? end - start
    : undefined;

/**
 * e.g. "EST (UTC-5)". Zones without a short name render as "UTC+5:30", since
 * Intl falls back to a "GMT+5:30" abbreviation that only repeats the offset.
 */
export const getZoneLabel = (locale: string, zone?: string) => {
  const now = DateTime.local({ zone }).setLocale(locale);
  const offset = `UTC${now.toFormat('Z')}`;
  const abbreviation = now.offsetNameShort;

  return abbreviation && !abbreviation.startsWith('GMT')
    ? `${abbreviation} (${offset})`
    : offset;
};

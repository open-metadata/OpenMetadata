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
import cronstrue from 'cronstrue';
import { capitalize, isNaN, isNil, toInteger, toNumber } from 'lodash';
import { DateTime, Duration } from 'luxon';
import {
  DAY_SECONDS,
  HOUR_SECONDS,
  MINUTE_SECONDS,
  MONTH_SECONDS,
  YEAR_SECONDS,
} from '../../constants/Date.constants';
import { DATE_TIME_SHORT_UNITS } from '../../enums/common.enum';
import { getCurrentLocaleForConstrue } from '../i18next/i18nextUtil';
import i18next from '../i18next/LocalUtil';

export const DATE_TIME_12_HOUR_FORMAT = 'MMM dd, yyyy, hh:mm a'; // e.g. Jan 01, 12:00 AM
export const DATE_TIME_WITH_OFFSET_FORMAT = "MMMM dd, yyyy, h:mm a '(UTC'ZZ')'"; // e.g. Jan 01, 12:00 AM (UTC+05:30)
export const DATE_TIME_WEEKDAY_WITH_ORDINAL = "ccc d'th' MMMM, yyyy, hh:mm a"; // e.g. Mon 1st January, 2025, 12:00 AM
/**
 * @param date EPOCH millis
 * @returns Formatted date for valid input. Format: MMM DD, YYYY, HH:MM AM/PM
 */
export const formatDateTime = (date?: number) => {
  if (isNil(date)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(date, { locale: i18next.language });

  return dateTime.toLocaleString(DateTime.DATETIME_MED);
};

/**
 * @param date EPOCH millis
 * @returns Formatted date for valid input. Format: MMM DD, YYYY
 */
export const formatDate = (date?: number, supportUTC = false) => {
  if (isNil(date)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(date, { locale: i18next.language });

  return supportUTC
    ? dateTime.toUTC().toLocaleString(DateTime.DATE_MED)
    : dateTime.setLocale(i18next.language).toLocaleString(DateTime.DATE_MED);
};

/**
 * @param date EPOCH millis
 * @returns Formatted month for valid input. Format: MMM (e.g. Jan, Feb, Mar)
 */
export const formatMonth = (date?: number) => {
  if (isNil(date) || isNaN(date)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(date, { locale: i18next.language });

  if (!dateTime.isValid) {
    return '';
  }

  return dateTime.toFormat('MMM');
};

/**
 * @param date EPOCH millis
 * @returns Formatted date for valid input. Format: MMM DD, YYYY
 */
export const formatDateTimeLong = (timestamp?: number, format?: string) => {
  if (isNil(timestamp)) {
    return '';
  }

  return DateTime.fromMillis(toNumber(timestamp), {
    locale: i18next.language,
  }).toFormat(format ?? DATE_TIME_WITH_OFFSET_FORMAT);
};

/**
 *
 * @returns
 */
export const getTimeZone = (): string => {
  // Getting local time zone
  const timeZoneToString = new Date()
    .toLocaleDateString(i18next.language, {
      day: '2-digit',
      timeZoneName: 'long',
    })
    .slice(4);

  // Line below finds out the abbreviation for time zone
  // e.g. India Standard Time --> IST
  const abbreviation = timeZoneToString.match(/\b[A-Z]+/g)?.join('') || '';

  return abbreviation;
};

/**
 *
 * @param timeStamp
 * @returns
 */
export const formatDateTimeWithTimezone = (timeStamp: number): string => {
  if (isNil(timeStamp)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(timeStamp, { locale: i18next.language });

  return dateTime.toLocaleString(DateTime.DATETIME_FULL);
};

/**
 * @param seconds EPOCH seconds
 * @returns Formatted duration for valid input. Format: 00:09:31
 */
export const formatTimeDurationFromSeconds = (seconds: number) =>
  isNil(seconds) ? '' : Duration.fromObject({ seconds }).toFormat('hh:mm:ss');

/**
 *
 * @param milliseconds
 * @param format
 * @returns
 */
export const customFormatDateTime = (
  milliseconds?: number,
  format?: string
) => {
  if (isNil(milliseconds)) {
    return '';
  }
  if (!format) {
    return formatDateTime(milliseconds);
  }

  return DateTime.fromMillis(milliseconds, {
    locale: i18next.language,
  }).toFormat(format);
};

/**
 *
 * @param timeStamp
 * @returns
 */
export const getRelativeTime = (timeStamp?: number): string => {
  return isNil(timeStamp)
    ? ''
    : DateTime.fromMillis(timeStamp, {
        locale: i18next.language,
      }).toRelative() ?? '';
};

/**
 * Returns a relative time like "10 mins ago" by converting the long form from Luxon.
 * Falls back to "" if timestamp is undefined or too recent.
 */
export const getShortRelativeTime = (timeStamp?: number): string => {
  if (isNil(timeStamp)) {
    return '';
  }

  const longForm = getRelativeTime(timeStamp); // e.g. "10 minutes ago"

  if (!longForm) {
    return '';
  }

  // Replace long time units with short ones
  const shortForm = longForm
    .split(' ')
    .map(
      (word) =>
        DATE_TIME_SHORT_UNITS[
          word.toUpperCase() as keyof typeof DATE_TIME_SHORT_UNITS
        ] || word
    )
    .join(' ');

  return shortForm;
};
/**
 *
 * @param timeStamp
 * @param baseTimeStamp
 * @returns
 */
export const getRelativeCalendar = (
  timeStamp: number,
  baseTimeStamp?: number
): string => {
  return capitalize(
    DateTime.fromMillis(timeStamp, {
      locale: i18next.language,
    }).toRelativeCalendar({
      base: baseTimeStamp
        ? DateTime.fromMillis(baseTimeStamp, { locale: i18next.language })
        : DateTime.now(),
    }) || ''
  );
};

/**
 * It returns the current date in ISO format, without the timezone offset
 */
export const getCurrentISODate = () =>
  DateTime.now().toISO({ includeOffset: false });

/**
 *
 * @returns
 */
export const getCurrentMillis = () => DateTime.now().toMillis();

export const getCurrentUnixInteger = () => DateTime.now().toUnixInteger();

export const getEpochMillisForPastDays = (days: number) =>
  DateTime.now().minus({ days }).toMillis();

export const getEpochMillisForFutureDays = (days: number) =>
  DateTime.now().plus({ days }).toMillis();

export const getUnixSecondsForPastDays = (days: number) =>
  DateTime.now().minus({ days }).toUnixInteger();

/**
 *
 * @param timestamp
 */
export const getDaysRemaining = (timestamp: number) =>
  toInteger(
    -DateTime.now().diff(DateTime.fromMillis(timestamp), ['days']).days
  );

export const isValidDateFormat = (format: string) => {
  try {
    const dt = DateTime.fromFormat(DateTime.now().toFormat(format), format);

    return dt.isValid;
  } catch {
    return false;
  }
};

export const getIntervalInMilliseconds = (
  startTime: number,
  endTime: number
) => {
  const startDateTime = DateTime.fromMillis(startTime);
  const endDateTime = DateTime.fromMillis(endTime);

  const interval = endDateTime.diff(startDateTime);

  return interval.milliseconds;
};

/**
 * Calculates the interval between two timestamps in milliseconds
 * and returns the result as a formatted string "X Days, Y Hours".
 *
 * @param startTime - The start time in milliseconds.
 * @param endTime - The end time in milliseconds.
 * @returns A formatted string representing the interval in "X Days, Y Hours".
 */
export const calculateInterval = (
  startTime: number,
  endTime: number
): string => {
  try {
    const intervalInMilliseconds = getIntervalInMilliseconds(
      startTime,
      endTime
    );

    const duration = Duration.fromMillis(intervalInMilliseconds);
    const days = Math.floor(duration.as('days'));
    const hours = Math.floor(duration.as('hours')) % 24;

    return `${days} Days, ${hours} Hours`;
  } catch {
    return 'Invalid interval';
  }
};

/**
 * Converts a given time in milliseconds to a human-readable format.
 *
 * @param milliseconds - The time duration in milliseconds to be converted.
 * @returns A human-readable string representation of the time duration.
 */
export const convertMillisecondsToHumanReadableFormat = (
  timestamp: number,
  length?: number,
  showMilliseconds = false,
  prependForNegativeValue = '-'
): string => {
  // Handle zero and very small positive values
  if (
    timestamp === 0 ||
    (!showMilliseconds && timestamp > 0 && timestamp < 1000)
  ) {
    return '0s';
  }

  // Handle negative values
  const isNegative = timestamp < 0;
  const absoluteTimestamp = Math.abs(timestamp);

  const duration = Duration.fromMillis(absoluteTimestamp);
  const result: string[] = [];

  // Extract each unit from the duration
  const years = Math.floor(duration.as('years'));
  const months = Math.floor(duration.as('months')) % 12;
  const days = Math.floor(duration.as('days')) % 30;
  const hours = Math.floor(duration.as('hours')) % 24;
  const minutes = Math.floor(duration.as('minutes')) % 60;
  const seconds = Math.floor(duration.as('seconds')) % 60;
  const milliseconds = Math.floor(duration.as('milliseconds')) % 1000;

  // Add non-zero units to the result
  if (years > 0) {
    result.push(`${years}Y`);
  }
  if (months > 0) {
    result.push(`${months}M`);
  }
  if (days > 0) {
    result.push(`${days}d`);
  }
  if (hours > 0) {
    result.push(`${hours}h`);
  }
  if (minutes > 0) {
    result.push(`${minutes}m`);
  }
  if (seconds > 0) {
    result.push(`${seconds}s`);
  }
  if (showMilliseconds && milliseconds > 0) {
    result.push(`${milliseconds}ms`);
  }

  // If no units found, return 0s
  if (result.length === 0) {
    return '0s';
  }

  let formattedResult = result.join(' ');

  if (length && result.length > length) {
    formattedResult = result.slice(0, length).join(' ');
  }

  // Prepend minus sign for negative values
  return isNegative
    ? `${prependForNegativeValue}${formattedResult}`
    : formattedResult;
};

/**
 * Convert backend-provided seconds into a compact human-readable string.
 * Uses fixed units (1Y=31104000s, 1M=2592000s, 1d=86400s, 1h=3600s, 1m=60s)
 * matching backend freshness calculations.
 * @param seconds Seconds (can be negative)
 * @param length Optional max number of units to include
 * @param prependForNegativeValue Prefix for negative values (default: '-')
 * @returns Compact string like "1Y 2M 5d 3h 15m 30s"
 */
export const convertSecondsToHumanReadableFormat = (
  seconds: number,
  length?: number,
  prependForNegativeValue = '-'
): string => {
  // Handle zero
  if (seconds === 0) {
    return '0s';
  }

  // Handle negative values
  const isNegative = seconds < 0;
  let remainingSeconds = Math.abs(seconds);

  const result: string[] = [];

  // Extract years first (using 360 days per year: 12 months × 30 days)
  const years = Math.floor(remainingSeconds / YEAR_SECONDS);
  if (years > 0) {
    result.push(`${years}Y`);
    remainingSeconds -= years * YEAR_SECONDS;
  }

  // Extract months (only from what remains after years)
  const months = Math.floor(remainingSeconds / MONTH_SECONDS);
  if (months > 0) {
    result.push(`${months}M`);
    remainingSeconds -= months * MONTH_SECONDS;
  }

  // Extract days
  const days = Math.floor(remainingSeconds / DAY_SECONDS);
  if (days > 0) {
    result.push(`${days}d`);
    remainingSeconds -= days * DAY_SECONDS;
  }

  // Extract hours
  const hours = Math.floor(remainingSeconds / HOUR_SECONDS);
  if (hours > 0) {
    result.push(`${hours}h`);
    remainingSeconds -= hours * HOUR_SECONDS;
  }

  // Extract minutes
  const minutes = Math.floor(remainingSeconds / MINUTE_SECONDS);
  if (minutes > 0) {
    result.push(`${minutes}m`);
    remainingSeconds -= minutes * MINUTE_SECONDS;
  }

  // Extract seconds
  const secs = Math.floor(remainingSeconds);
  if (secs > 0) {
    result.push(`${secs}s`);
  }

  // If no units found, return 0s
  if (result.length === 0) {
    return '0s';
  }

  let formattedResult = result.join(' ');

  if (length && result.length > length) {
    formattedResult = result.slice(0, length).join(' ');
  }

  // Prepend prefix for negative values
  return isNegative
    ? `${prependForNegativeValue}${formattedResult}`
    : formattedResult;
};

export const formatDuration = (ms: number) => {
  const seconds = ms / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;

  const pluralize = (value: number, unit: string) =>
    `${value.toFixed(2)} ${unit}${value === 1 ? '' : 's'}`;

  if (seconds < 60) {
    return pluralize(seconds, 'second');
  } else if (minutes < 60) {
    return pluralize(minutes, 'minute');
  } else {
    return pluralize(hours, 'hour');
  }
};
export const formatDurationToHHMMSS = (ms: number) => {
  return Duration.fromMillis(ms).toFormat('hh:mm:ss');
};

export const getStartOfDayInMillis = (timestamp: number) =>
  DateTime.fromMillis(timestamp).toUTC().startOf('day').toMillis();

export const getEndOfDayInMillis = (timestamp: number) =>
  DateTime.fromMillis(timestamp).toUTC().endOf('day').toMillis();

export const getCurrentDayStartGMTinMillis = () =>
  DateTime.now().setZone('GMT').startOf('day').toMillis();

export const getCurrentDayEndGMTinMillis = () =>
  DateTime.now().setZone('GMT').endOf('day').toMillis();

export const getDayAgoStartGMTinMillis = (days: number) =>
  DateTime.now().setZone('GMT').minus({ days }).startOf('day').toMillis();

export const getSevenDaysStartGMTArrayInMillis = () => {
  const sevenDaysStartGMTArrayInMillis = [];
  for (let i = 6; i >= 0; i--) {
    sevenDaysStartGMTArrayInMillis.push(getDayAgoStartGMTinMillis(i));
  }

  return sevenDaysStartGMTArrayInMillis;
};

export const getScheduleDescriptionTexts = (scheduleInterval: string) => {
  try {
    const scheduleDescription = cronstrue.toString(scheduleInterval, {
      use24HourTimeFormat: false,
      verbose: true,
      locale: getCurrentLocaleForConstrue(), // To get localized string
    });

    const firstSentenceEndIndex = scheduleDescription.indexOf(',');

    const descriptionFirstPart = scheduleDescription
      .slice(0, firstSentenceEndIndex)
      .trim();

    const descriptionSecondPart = capitalize(
      scheduleDescription.slice(firstSentenceEndIndex + 1).trim()
    );

    return { descriptionFirstPart, descriptionSecondPart };
  } catch {
    return { descriptionFirstPart: '', descriptionSecondPart: '' };
  }
};

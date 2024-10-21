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
import { capitalize, isNil, toInteger, toNumber } from 'lodash';
import { DateTime, Duration } from 'luxon';

/**
 * @param date EPOCH millis
 * @returns Formatted date for valid input. Format: MMM DD, YYYY, HH:MM AM/PM
 */
export const formatDateTime = (date?: number) => {
  if (isNil(date)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(date, { locale: 'en-US' });

  return dateTime.toLocaleString(DateTime.DATETIME_MED);
};

/**
 * @param date EPOCH millis
 * @returns Formatted date for valid input. Format: MMM DD, YYYY
 */
export const formatDate = (date?: number) => {
  if (isNil(date)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(date, { locale: 'en-US' });

  return dateTime.setLocale('en-US').toLocaleString(DateTime.DATE_MED);
};

/**
 * @param date EPOCH millis
 * @returns Formatted date for valid input. Format: MMM DD, YYYY
 */
export const formatDateTimeLong = (timestamp: number, format?: string) =>
  DateTime.fromMillis(toNumber(timestamp), { locale: 'en-US' }).toFormat(
    format || "ccc d'th' MMMM, yyyy, hh:mm a"
  );

/**
 *
 * @returns
 */
export const getTimeZone = (): string => {
  // Getting local time zone
  const timeZoneToString = new Date()
    .toLocaleDateString('en-US', {
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

  const dateTime = DateTime.fromMillis(timeStamp, { locale: 'en-US' });

  return dateTime.toLocaleString(DateTime.DATETIME_FULL);
};

/**
 * @param seconds EPOCH seconds
 * @returns Formatted duration for valid input. Format: 00:09:31
 */
export const formatTimeDurationFromSeconds = (seconds: number) =>
  !isNil(seconds) ? Duration.fromObject({ seconds }).toFormat('hh:mm:ss') : '';

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

  return DateTime.fromMillis(milliseconds, { locale: 'en-US' }).toFormat(
    format
  );
};

/**
 *
 * @param timeStamp
 * @returns
 */
export const getRelativeTime = (timeStamp?: number): string => {
  return !isNil(timeStamp)
    ? DateTime.fromMillis(timeStamp, { locale: 'en-US' }).toRelative() ?? ''
    : '';
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
    DateTime.fromMillis(timeStamp, { locale: 'en-US' }).toRelativeCalendar({
      base: baseTimeStamp
        ? DateTime.fromMillis(baseTimeStamp, { locale: 'en-US' })
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
  } catch (error) {
    return false;
  }
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
    const startDateTime = DateTime.fromMillis(startTime);
    const endDateTime = DateTime.fromMillis(endTime);

    const interval = endDateTime.diff(startDateTime);
    const duration = Duration.fromMillis(interval.milliseconds);
    const days = Math.floor(duration.as('days'));
    const hours = Math.floor(duration.as('hours')) % 24;

    return `${days} Days, ${hours} Hours`;
  } catch (error) {
    return 'Invalid interval';
  }
};

const intervals: [string, number][] = [
  ['Y', 933120000000], // 1000 * 60 * 60 * 24 * 30 * 360
  ['M', 2592000000], // 1000 * 60 * 60 * 24 * 30
  ['d', 86400000], // 1000 * 60 * 60 * 24
  ['h', 3600000], // 1000 * 60 * 60
  ['m', 60000], // 1000 * 60
  ['s', 1000], // 1000
];

/**
 * Converts a given time in milliseconds to a human-readable format.
 *
 * @param milliseconds - The time duration in milliseconds to be converted.
 * @returns A human-readable string representation of the time duration.
 */
export const convertMillisecondsToHumanReadableFormat = (
  milliseconds: number
): string => {
  if (milliseconds <= 0) {
    return '0s';
  }

  const result: string[] = [];
  let remainingMilliseconds = milliseconds;

  for (const [name, count] of intervals) {
    if (remainingMilliseconds < count) {
      continue; // Skip smaller units
    }
    const value = Math.floor(remainingMilliseconds / count);
    remainingMilliseconds %= count;
    result.push(`${value}${name}`);
  }

  return result.join(' ');
};

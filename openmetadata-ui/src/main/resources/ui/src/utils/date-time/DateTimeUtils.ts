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
 * @param date EPOCH seconds
 * @returns Formatted date for valid input. Format: MMM DD, YYYY, HH:MM AM/PM
 */
export const formatDateTimeFromSeconds = (date?: number) => {
  if (isNil(date)) {
    return '';
  }

  return formatDateTime(date * 1000);
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

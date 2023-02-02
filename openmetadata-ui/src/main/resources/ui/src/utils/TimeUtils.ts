/*
 *  Copyright 2022 Collate.
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

export const getTimeByTimeStamp = (timeStamp: number): string =>
  DateTime.fromMillis(timeStamp).toFormat('hh:mm a');

export const getRelativeDateByTimeStamp = (
  timeStamp: number,
  baseTimeStamp?: number
): string => {
  return capitalize(
    DateTime.fromMillis(timeStamp).toRelativeCalendar({
      base: baseTimeStamp ? DateTime.fromMillis(baseTimeStamp) : DateTime.now(),
    }) || ''
  );
};

export const getDayTimeByTimeStamp = (timeStamp: number): string => {
  return DateTime.fromMillis(timeStamp).toRelative() || '';
};

export const getUTCDateTime = (dateTime: string) => {
  const dateObject = new Date(dateTime);

  return Date.UTC(
    dateObject.getUTCFullYear(),
    dateObject.getUTCMonth(),
    dateObject.getUTCDate(),
    dateObject.getUTCHours(),
    dateObject.getUTCMinutes(),
    dateObject.getUTCSeconds()
  );
};

/**
 * It takes a timestamp and returns a formatted date string
 * @param {number} timeStamp - The timestamp you want to convert to a date.
 * @param {string} [format] - The format of the date time string.
 * @returns A string
 */
export const getDateTimeByTimeStamp = (
  timeStamp: number,
  format?: string
): string => {
  return DateTime.fromMillis(timeStamp).toFormat(
    format || 'dd MMM yyyy hh:mm a'
  );
};

/**
 * It takes a timestamp and returns a formatted date string
 * @param {number} timeStamp - The timestamp you want to convert to a date.
 * @param {string} [format] - The format of the date you want to return.
 * @returns A string
 */
export const getDateByTimeStamp = (
  timeStamp: number,
  format?: string
): string => {
  return DateTime.fromMillis(timeStamp).toFormat(format || 'dd MMM yyyy');
};

/**
 * It takes a timestamp and returns a relative date time string
 * @param {number} timestamp - number - The timestamp to convert to a relative date time.
 */
export const getRelativeDateTimeByTimeStamp = (timestamp: number): string =>
  DateTime.fromMillis(timestamp as number).toRelative() || '';

export const getLocaleDateFromTimeStamp = (timeStamp: number): string => {
  return DateTime.fromMillis(timeStamp).toISO({ includeOffset: false });
};

/**
 * It returns the current date in ISO format, without the timezone offset
 */
export const getCurrentLocaleDate = () =>
  DateTime.now().toISO({ includeOffset: false });

/**
 * "Get a future date from the current date by adding a number of days to it."
 *
 * The function takes a number of days as an argument and returns a future date
 * @param {number} days - number - The number of days to add to the current date.
 */
export const getFutureLocaleDateFromCurrentDate = (days: number) =>
  DateTime.now().plus({ days: days }).toISO({ includeOffset: false });

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

export const getDateTimeByTimeStampWithZone = (timeStamp: number): string => {
  return `${DateTime.fromMillis(timeStamp).toFormat(
    'dd MMM yyyy, hh:mm'
  )} ${getTimeZone()}`;
};

/**
 * It takes a number, a time unit and a format and returns a formatted date time string
 * @param {number | string} expiry - The number of days/months/years/hours/minutes/seconds you want to
 * add to the current date.
 * @param {string} timeUnit - This is the time unit that you want to add to the current date. It can be
 * any of the following:
 * @param {string} [format] - The format of the date you want to return like 'year' | 'quarter'
 * | 'month' | 'week' | 'day'.
 */

export const getExpiryDateTimeFromDate = (
  expiry: number | string,
  timeUnit: string,
  format?: string
) =>
  DateTime.now()
    .plus({ [timeUnit]: toNumber(expiry) })
    .toFormat(format || "ccc d'th' MMMM, yyyy,hh:mm a");

/**
 * It takes a timestamp and returns a formatted date string
 * @param {number | string} expiry - The expiry time in milliseconds.
 * @param {string} [format] - The format of the date you want to return
 * and default format is 'ccc d'th' MMMM, yyyy,hh:mm a'.
 */
export const getExpiryDateTimeFromTimeStamp = (
  expiry: number | string,
  format?: string
) =>
  DateTime.fromMillis(toNumber(expiry)).toFormat(
    format || "ccc d'th' MMMM, yyyy,hh:mm a"
  );

/**
 * It takes a number of seconds and returns a formatted date or time string
 * @param {number} seconds - number - The number of seconds to convert to a date or time.
 * @param {string} [format] - The format of the date or time you want to get by default format is 'DD'.
 */
export const getDateOrTimeFromSeconds = (seconds: number, format?: string) =>
  DateTime.fromSeconds(seconds).toFormat(format || 'DD');

/**
 * It returns the number of seconds since the Unix Epoch for a date that is pastDayCount days before
 * the current date
 * @param {number} pastDayCount - The number of days you want to go back from the current date.
 */
export const getPastDatesTimeStampFromCurrentDate = (pastDayCount: number) =>
  DateTime.now().minus({ days: pastDayCount }).toUnixInteger();

/**
 * Get the current date and time in seconds.
 */
export const getCurrentDateTimeStamp = () => DateTime.now().toUnixInteger();

/**
 * Get the current date and time in milliseconds.
 */
export const getCurrentDateTimeMillis = () => DateTime.now().toMillis();

/**
 * It returns the number of milliseconds since the Unix Epoch for a date that is pastDayCount days before
 * the current date
 * @param {number} days - The number of days you want to go back from the current date.
 */
export const getPastDaysDateTimeMillis = (days: number) =>
  DateTime.now().minus({ days }).toMillis();

/**
 * It takes a timestamp in seconds and returns a formatted date string
 * @param {number} timeStamp - The timeStamp in seconds.
 * @param {string} [format] - The format of the date you want to get default format is 'dd/MMM HH:mm'.
 */
export const getFormattedDateFromSeconds = (
  timeStamp: number,
  format?: string
) => DateTime.fromSeconds(timeStamp || 0).toFormat(format || 'dd/MMM HH:mm');
/**
 * It takes a timestamp in milliseconds and returns a formatted date string
 * @param {number} timeStamp - The timeStamp in milliseconds.
 * @param {string} [format] - The format of the date you want to get default format is 'dd/MMM'.
 */
export const getFormattedDateFromMilliSeconds = (
  timeStamp: number,
  format?: string
) => DateTime.fromMillis(timeStamp || 0).toFormat(format || 'dd/MMM');

/**
 * It takes a timestamp in milliseconds and returns a formatted date like 'Oct 14, 1983, 9:30 AM'.
 * reference: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
 * @param timeStamp The timeStamp in milliseconds.
 * @returns formatted date like 'Oct 14, 1983, 9:30 AM'.
 */
export const getDateTimeFromMilliSeconds = (timeStamp: number) =>
  DateTime.fromMillis(timeStamp).toFormat("DDD 'at' hh:mm a");

/**
 * @param seconds EPOCH seconds
 * @returns Formatted duration for valid input. Format: 00:09:31
 */
export const getTimeDurationFromSeconds = (seconds: number) =>
  !isNil(seconds) ? Duration.fromObject({ seconds }).toFormat('hh:mm:ss') : '';

/**
 * It takes a timestamp and returns a string in the format of "dd MMM yyyy, hh:mm"
 * @param {number} timeStamp - number - The timestamp you want to convert to a date.
 * @returns A string ex: 23 May 2022, 23:59
 */
export const getDateTimeByTimeStampWithCommaSeparated = (
  timeStamp: number
): string => {
  return `${DateTime.fromMillis(timeStamp).toFormat('dd MMM yyyy, hh:mm')}`;
};

/**
 * Given a date string, return the time stamp of that date.
 * @param {string} date - The date you want to convert to a timestamp.
 * @deprecated
 */
export const getTimeStampByDate = (date: string) => Date.parse(date);

/**
 * @param date EPOCH Millis
 * @returns Formatted date for valid input. Format: MMM DD, YYYY, HH:MM AM/PM TimeZone
 */
export const formatDateTimeWithTimeZone = (date: number) => {
  if (isNil(date)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(date);

  return dateTime.toLocaleString(DateTime.DATETIME_FULL);
};

/**
 * @param date EPOCH Millis
 * @returns Formatted date for valid input. Format: MMM DD, YYYY, HH:MM AM/PM
 */
export const formatDateTime = (date: number) => {
  if (isNil(date)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(date);

  return dateTime.toLocaleString(DateTime.DATETIME_MED);
};

/**
 * @param date EPOCH seconds
 * @returns Formatted date for valid input. Format: MMM DD, YYYY, HH:MM AM/PM
 */
export const formatDateTimeFromSeconds = (date: number) => {
  if (isNil(date)) {
    return '';
  }

  const dateTime = DateTime.fromSeconds(date);

  return dateTime.toLocaleString(DateTime.DATETIME_MED);
};

export const getTimeStampByDateTime = (dateTime: string) =>
  DateTime.fromSQL(dateTime).toMillis();

/**
 *
 * @param timeStamp timestamp in milliSeconds
 * @returns days count
 */
export const getNumberOfDaysForTimestamp = (timeStamp: number) =>
  toInteger(
    -DateTime.now().diff(DateTime.fromMillis(timeStamp), ['days']).days
  );

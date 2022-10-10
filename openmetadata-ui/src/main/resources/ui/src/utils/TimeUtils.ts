/*
 *  Copyright 2021 Collate
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
import { toNumber } from 'lodash';
import { DateTime } from 'luxon';

const msPerSecond = 1000;
const msPerMinute = 60 * msPerSecond;
const msPerHour = msPerMinute * 60;
const msPerDay = msPerHour * 24;
const msPerMonth = msPerDay * 30;
const msPerYear = msPerDay * 365;

const formattingObj = {
  sameDay: "'Today'",
  lastDay: "'Yesterday'",
  lastWeek: 'dd MMMM yyyy',
  sameElse: 'dd MMMM yyyy',
};

const activityFeedTimeFormat = {
  sameDay: "'Today at' t a",
  lastDay: "'Yesterday at' t a",
  lastWeek: "'Last' EEEE 'at' t a",
  sameElse: 'dd/MM/yyyy',
};

/**
 * If the difference between the two dates is less than -1, return 'lastWeek'. If the difference is
 * less than 0, return 'lastDay'. If the difference is less than 1, return 'sameDay'. Otherwise, return
 * 'sameElse'.
 * @param {DateTime} myDateTime - The date you want to format.
 * @param {DateTime} now - The current date and time.
 * @returns A string
 */
const getCalendarFormat = (myDateTime: DateTime, now: DateTime): string => {
  const diff = myDateTime.diff(now.startOf('day'), 'days').as('days');

  if (diff < -1) return 'lastWeek';

  if (diff < 0) return 'lastDay';

  if (diff < 1) return 'sameDay';

  return 'sameElse';
};

export const getRelativeTimeDifference = (
  current: number,
  previous: number
): string => {
  const elapsed = current - previous;

  if (elapsed <= msPerSecond) {
    return 'now';
  } else if (elapsed < msPerMinute / 5) {
    return 'a few seconds ago';
  } else if (elapsed < msPerMinute) {
    const relativeTime = Math.round(elapsed / msPerSecond);

    return `${relativeTime} second${relativeTime > 1 ? 's' : ''} ago`;
  } else if (elapsed < msPerHour) {
    const relativeTime = Math.round(elapsed / msPerMinute);

    return `${relativeTime} minute${relativeTime > 1 ? 's' : ''} ago`;
  } else if (elapsed < msPerDay) {
    const relativeTime = Math.round(elapsed / msPerHour);

    return `${relativeTime} hour${relativeTime > 1 ? 's' : ''} ago`;
  } else if (elapsed < msPerMonth) {
    const relativeTime = Math.round(elapsed / msPerDay);

    return `${relativeTime} day${relativeTime > 1 ? 's' : ''} ago`;
  } else if (elapsed < msPerYear) {
    const relativeTime = Math.round(elapsed / msPerMonth);

    return `${relativeTime} month${relativeTime > 1 ? 's' : ''} ago`;
  } else {
    const relativeTime = Math.round(elapsed / msPerYear);

    return `${relativeTime} year${relativeTime > 1 ? 's' : ''} ago`;
  }
};

export const getRelativeDayDifference = (
  current: number,
  previous: number
): string => {
  const elapsed = current - previous;

  if (elapsed < msPerDay / 6) {
    return 'in last few hours';
  } else if (elapsed < msPerDay) {
    return 'today';
  } else if (elapsed < msPerMonth) {
    const relativeTime = Math.round(elapsed / msPerDay);

    return `in last ${relativeTime} day${relativeTime > 1 ? 's' : ''}`;
  } else if (elapsed < msPerYear) {
    const relativeTime = Math.round(elapsed / msPerMonth);

    return `${relativeTime} month${relativeTime > 1 ? 's' : ''} ago`;
  } else {
    const relativeTime = Math.round(elapsed / msPerYear);

    return `${relativeTime} year${relativeTime > 1 ? 's' : ''} ago`;
  }
};

export const getRelativeTime = (timestamp: number): string => {
  return getRelativeTimeDifference(Date.now(), timestamp);
};

const getFormattedDateTime = (
  dt1: DateTime,
  dt2: DateTime,
  formattingRulesObj: Record<string, string>
) => {
  const format = getCalendarFormat(dt1, dt2) || 'sameElse';

  return dt1.toFormat(formattingRulesObj[format]);
};

export const getRelativeDay = (timestamp: number): string => {
  return getRelativeDayDifference(Date.now(), timestamp);
};

export const getRelativeDateByTimeStamp = (timeStamp: number): string => {
  return getFormattedDateTime(
    DateTime.fromMillis(timeStamp),
    DateTime.now(),
    formattingObj
  );
};

export const getTimeByTimeStamp = (timeStamp: number): string =>
  DateTime.fromMillis(timeStamp).toFormat('hh:mm a');

export const getDayTimeByTimeStamp = (timeStamp: number): string => {
  return getFormattedDateTime(
    DateTime.fromMillis(timeStamp),
    DateTime.now(),
    activityFeedTimeFormat
  );
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
 * It takes a timestamp and returns a relative date time string
 * @param {number} timestamp - number - The timestamp to convert to a relative date time.
 */
export const getRelativeDateTimeByTimeStamp = (timestamp: number) =>
  DateTime.fromMillis(timestamp as number).toRelative();

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

  // Line below finds out the abbrevation for time zone
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
export const getPastDatesToMilliSecondsFromCurrentDate = (
  pastDayCount: number
) => DateTime.now().minus({ days: pastDayCount }).toMillis();

/**
 * Get the current date and time in seconds.
 */
export const getDateToMilliSecondsOfCurrentDate = () =>
  DateTime.now().toMillis();

/**
 * It takes a timestamp in seconds and returns a formatted date string
 * @param {number} timeStamp - The timeStamp in seconds.
 * @param {string} [format] - The format of the date you want to get default format is 'dd/MMM HH:mm'.
 */
export const getFormattedDateFromSeconds = (
  timeStamp: number,
  format?: string
) => DateTime.fromSeconds(timeStamp || 0).toFormat(format || 'dd/MMM HH:mm');

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

export const getDateTimeByTimeStamp = (timeStamp: number): string => {
  return DateTime.fromMillis(timeStamp).toFormat('dd MMM yyyy hh:mm a');
};

export const getLocaleDate = (timeStamp: number): string => {
  return DateTime.fromMillis(timeStamp).toISO({ includeOffset: false });
};

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

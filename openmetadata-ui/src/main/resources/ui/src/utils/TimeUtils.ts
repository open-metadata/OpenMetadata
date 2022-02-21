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
import moment from 'moment';

const msPerSecond = 1000;
const msPerMinute = 60 * msPerSecond;
const msPerHour = msPerMinute * 60;
const msPerDay = msPerHour * 24;
const msPerMonth = msPerDay * 30;
const msPerYear = msPerDay * 365;

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

export const getRelativeDay = (timestamp: number): string => {
  return getRelativeDayDifference(Date.now(), timestamp);
};

export const getRelativeDateByTimeStamp = (timeStamp: number): string => {
  return moment(timeStamp).calendar(null, {
    sameDay: '[Today]',
    nextDay: 'DD MMMM YYYY',
    nextWeek: 'DD MMMM YYYY',
    lastDay: '[Yesterday]',
    lastWeek: 'DD MMMM YYYY',
    sameElse: 'DD MMMM YYYY',
  });
};

export const getTimeByTimeStamp = (timeStamp: number): string => {
  return moment(timeStamp, 'x').format('hh:mm A');
};

export const getDayTimeByTimeStamp = (timeStamp: number): string => {
  return moment(timeStamp, 'x').calendar();
};

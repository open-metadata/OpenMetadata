/**
 * Copyright 2017 Hortonworks.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *   http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
/* eslint-disable */

import moment from 'moment';

const sortArray = function (sortingArr, keyName, ascendingFlag) {
  if (ascendingFlag) {
    return sortingArr.sort(function (a, b) {
      if (a[keyName] < b[keyName]) {
        return -1;
      }
      if (a[keyName] > b[keyName]) {
        return 1;
      }

      return 0;
    });
  } else {
    return sortingArr.sort(function (a, b) {
      if (b[keyName] < a[keyName]) {
        return -1;
      }
      if (b[keyName] > a[keyName]) {
        return 1;
      }

      return 0;
    });
  }
};

const numberToMilliseconds = function (number, type) {
  let millisecond = 1000;

  type = type.toLowerCase();
  if (type === 'seconds') {
    return number * millisecond;
  } else if (type === 'minutes') {
    return number * (millisecond * 60);
  } else if (type === 'hours') {
    return number * (millisecond * 60 * 60);
  } else if (type === 'days') {
    return number * (millisecond * 60 * 60 * 24);
  } else if (type === 'weeks') {
    return number * (millisecond * 60 * 60 * 24 * 7);
  } else if (type === 'years') {
    return number * (millisecond * 60 * 60 * 24 * 365);
  }
};

const findBeginingEndingTime = function (
  startDate,
  start_time,
  end_time,
  lastDataObj,
  time_unit,
  time_interval
) {
  let begining, ending, momentObj;
  let timeUnit = time_unit.toLowerCase();

  // checking to add s character at the end of minute/second/hour string
  if (timeUnit[timeUnit.length - 1] !== 's') {
    timeUnit += 's';
  }
  if (lastDataObj) {
    momentObj = moment(lastDataObj.executionDate);
  } else {
    momentObj = startDate ? moment(startDate.valueOf()) : moment(end_time);
  }
  // time manipulation as per local browser time offset
  // momentObj.add(-(currentOffset), 'minutes');
  // to show timeline chart from right
  momentObj.subtract(time_interval * 21, timeUnit);
  begining = momentObj.valueOf();
  // to always have 24 ticks in execution metrics and then scrolling works (to resolve overlapping issue)
  ending = moment(moment(begining).toDate())
    .add(time_interval * 24, timeUnit)
    .valueOf();

  return {
    begining,
    ending,
    timeUnit,
  };
};

const getStatusBox = (statusObj) => {
  switch (statusObj.status && statusObj.status.toLowerCase()) {
    case 'not deployed':
    case 'unknown':
    case 'not-running':
      return { className: 'not-running', title: 'Not Running' };
    case 'finished':
    case 'success':
    case 'enabled':
    case 'active':
    case 'done':
      return { className: 'done', title: 'Success' };
    case 'running':
      return { className: 'running', title: 'Running' };
    case 'pending':
      return { className: 'pending', title: 'Pending' };
    case 'killed':
      return { className: 'failed', title: 'Killed' };
    case 'upstream_failed':
    case 'failed':
      return { className: 'failed', title: 'Failed' };
    case 'paused':
      return { className: 'paused', title: 'Paused' };
    case 'queued':
      return { className: 'queued', title: 'Queued' };
    default:
      return { className: 'not-running', title: 'Not Running' };
  }
};

export default {
  findBeginingEndingTime,
  getStatusBox,
  numberToMilliseconds,
  sortArray,
};

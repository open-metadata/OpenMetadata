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
import { parseDate } from '@internationalized/date';
import type {
  DateRangePickerPreset,
  DateRangePickerValue,
} from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { DateTime } from 'luxon';
import { DateFilterType, DateRangeObject } from 'Models';
import {
  getCurrentDayEndGMTinMillis,
  getDayAgoStartGMTinMillis,
} from './date-time/DateTimeUtils';
import { t } from './i18next/LocalUtil';

const DATE_FORMAT = 'yyyy-MM-dd';

export const getTimestampLabel = (
  startDate: string,
  endDate: string,
  showSelectedCustomRange?: boolean
) => {
  let label = t('label.custom-range');
  if (showSelectedCustomRange) {
    label += `: ${startDate} -> ${endDate}`;
  }

  return label;
};

export const getDaysCount = (startDate: string, endDate: string) => {
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const timeDifference = endDateObj.getTime() - startDateObj.getTime();

  // Dividing time difference with number of milliseconds in a day to get number of days
  const numOfDays = timeDifference / (1000 * 60 * 60 * 24);

  return numOfDays;
};

export const getCoreDateValueFromMillis = (
  timestamp: number
): DateRangePickerValue['start'] =>
  parseDate(
    DateTime.fromMillis(timestamp).toUTC().toFormat(DATE_FORMAT)
  ) as unknown as DateRangePickerValue['start'];

export const getCoreDateRangeValue = (
  dateRange?: Partial<DateRangeObject>
): DateRangePickerValue | null => {
  if (isUndefined(dateRange?.startTs) || isUndefined(dateRange?.endTs)) {
    return null;
  }

  return {
    start: getCoreDateValueFromMillis(dateRange.startTs),
    end: getCoreDateValueFromMillis(dateRange.endTs),
  };
};

export const getDateStringFromCoreDateValue = (
  value: DateRangePickerValue['start']
) => DateTime.utc(value.year, value.month, value.day).toFormat(DATE_FORMAT);

export const getMillisFromCoreDateValue = (
  value: DateRangePickerValue['start'],
  boundary: 'start' | 'end'
) => {
  const dateTime = DateTime.utc(value.year, value.month, value.day);

  return boundary === 'start'
    ? dateTime.startOf('day').valueOf()
    : dateTime.endOf('day').valueOf();
};

export const getDateRangeObjectFromDateRangePreset = ({
  menuOptions,
  presetKey,
}: {
  menuOptions: DateFilterType;
  presetKey: string;
}): { days?: number; range: DateRangeObject } | undefined => {
  const filterRange = menuOptions[presetKey];
  if (isUndefined(filterRange)) {
    return;
  }

  return {
    days: filterRange.days,
    range: {
      startTs: getDayAgoStartGMTinMillis(filterRange.days),
      endTs: getCurrentDayEndGMTinMillis(),
      key: presetKey,
      title: filterRange.title,
    },
  };
};

export const getDateRangeObjectFromCorePicker = ({
  menuOptions,
  presetKey,
  showSelectedCustomRange,
  value,
}: {
  menuOptions: DateFilterType;
  presetKey?: string;
  showSelectedCustomRange?: boolean;
  value: DateRangePickerValue;
}): { days?: number; range: DateRangeObject } => {
  if (presetKey) {
    const selectedPreset = getDateRangeObjectFromDateRangePreset({
      menuOptions,
      presetKey,
    });
    if (!isUndefined(selectedPreset)) {
      return selectedPreset;
    }
  }

  const startDate = getDateStringFromCoreDateValue(value.start);
  const endDate = getDateStringFromCoreDateValue(value.end);
  const days = getDaysCount(startDate, endDate);
  const title = showSelectedCustomRange
    ? `${startDate} -> ${endDate}`
    : getTimestampLabel(startDate, endDate, false);

  return {
    days,
    range: {
      startTs: getMillisFromCoreDateValue(value.start, 'start'),
      endTs: getMillisFromCoreDateValue(value.end, 'end'),
      key: 'customRange',
      title,
    },
  };
};

export const getDateRangePickerPresets = (
  menuOptions: DateFilterType
): DateRangePickerPreset[] =>
  Object.entries(menuOptions).map(([key, value]) => ({
    key,
    label: value.title,
    value: {
      start: getCoreDateValueFromMillis(getDayAgoStartGMTinMillis(value.days)),
      end: getCoreDateValueFromMillis(getCurrentDayEndGMTinMillis()),
    },
  }));

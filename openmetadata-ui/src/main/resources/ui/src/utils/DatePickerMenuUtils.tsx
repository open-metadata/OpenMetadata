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
import { t } from './i18next/LocalUtil';

export const CUSTOM_DATE_RANGE_KEY = 'customRange';

export const getTimestampLabel = (
  startDate: string,
  endDate: string,
  showSelectedCustomRange?: boolean
) => {
  if (showSelectedCustomRange) {
    return `${startDate} -> ${endDate}`;
  }

  return t('label.custom-range');
};

export const getDaysCount = (startDate: string, endDate: string) => {
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const timeDifference = endDateObj.getTime() - startDateObj.getTime();

  // Dividing time difference with number of milliseconds in a day to get number of days
  const numOfDays = timeDifference / (1000 * 60 * 60 * 24);

  return numOfDays;
};

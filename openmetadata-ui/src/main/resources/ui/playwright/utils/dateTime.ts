/*
 *  Copyright 2025 Collate.
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
import { isNil } from 'lodash';
import { DateTime } from 'luxon';

export const getCurrentMillis = () => DateTime.now().toMillis();

export const getEpochMillisForFutureDays = (days: number) =>
  DateTime.now().plus({ days }).toMillis();

export const formatDateTime = (date?: number) => {
  if (isNil(date)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(date, { locale: 'en-US' });

  return dateTime.toLocaleString(DateTime.DATETIME_MED);
};

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

export const getDayAgoStartGMTinMillis = (days: number) =>
  DateTime.now().setZone('GMT').minus({ days }).startOf('day').toMillis();

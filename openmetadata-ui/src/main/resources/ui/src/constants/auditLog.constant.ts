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

import { DateFilterType } from 'Models';

export const AUDIT_LOG_TIME_FILTER_RANGE: DateFilterType = {
  yesterday: {
    days: 1,
    title: 'label.yesterday',
  },
  last7days: {
    days: 7,
    title: 'label.last-number-of-days',
    titleData: {
      numberOfDays: 7,
    },
  },
  last30days: {
    days: 30,
    title: 'label.last-number-of-days',
    titleData: {
      numberOfDays: 30,
    },
  },
};

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

import { StatusType } from '../generated/entity/data/pipeline';

export const MenuOptions = {
  all: 'All',
  [StatusType.Successful]: 'Success',
  [StatusType.Failed]: 'Failure',
  [StatusType.Pending]: 'Pending',
  Aborted: 'Aborted',
};

export const EXECUTION_FILTER_RANGE = {
  last3days: { days: 3, title: 'Last 3 days' },
  last7days: { days: 7, title: 'Last 7 days' },
  last14days: { days: 14, title: 'Last 14 days' },
  last30days: { days: 30, title: 'Last 30 days' },
  last60days: { days: 60, title: 'Last 60 days' },
  last365days: { days: 365, title: 'Last 365 days' },
};

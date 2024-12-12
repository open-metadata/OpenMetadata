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

import i18n from '../utils/i18next/LocalUtil';

export const QUERY_USED_BY_TABLE_VIEW_CAP = 3;
export const QUERY_LINE_HEIGHT = 4;
export const QUERY_DATE_FORMAT = "'On' MMMM dd 'at' h:mma 'UTC'ZZ"; // eg: On March 6th at 6:20pm UTC+1

export const QUERY_PAGE_LOADING_STATE = {
  page: true,
  rightPanel: true,
  query: true,
};
export const QUERY_PAGE_ERROR_STATE = {
  page: false,
  search: false,
};
export const QUERY_PAGE_DEFAULT_FILTER = {
  initialOptions: [],
  options: [],
  selected: [],
};
export const QUERY_SORT_OPTIONS = [
  { value: 'queryDate', name: i18n.t('label.created-date') },
  { value: 'updatedAt', name: i18n.t('label.last-updated') },
  { value: 'totalVotes', name: i18n.t('label.popularity') },
];

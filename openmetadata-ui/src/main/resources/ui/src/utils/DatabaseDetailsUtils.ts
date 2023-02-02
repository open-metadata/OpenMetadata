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

import i18next from 'i18next';
import { TabSpecificField } from '../enums/entity.enum';

export const databaseDetailsTabs = [
  {
    name: i18next.t('label.schemas'),
    path: 'schemas',
  },
  {
    name: i18next.t('label.activity-feed-plural'),
    path: 'activity_feed',
    field: TabSpecificField.ACTIVITY_FEED,
  },
];

export const getCurrentDatabaseDetailsTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'activity_feed':
      currentTab = 2;

      break;

    case 'schemas':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};

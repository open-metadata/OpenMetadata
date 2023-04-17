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

import i18n from 'utils/i18next/LocalUtil';
import { TabSpecificField } from '../enums/entity.enum';

export const defaultFields = `${TabSpecificField.USAGE_SUMMARY}, 
${TabSpecificField.FOLLOWERS}, ${TabSpecificField.TAGS}, ${TabSpecificField.OWNER}, ${TabSpecificField.DASHBOARD} ,${TabSpecificField.EXTENSION}`;

export const mlModelTabs = [
  {
    name: i18n.t('label.feature-plural'),
    path: 'features',
  },
  {
    name: i18n.t('label.activity-feed'),
    path: 'activity_feed',
    field: TabSpecificField.ACTIVITY_FEED,
  },
  {
    name: i18n.t('label.detail-plural'),
    path: 'details',
  },
  {
    name: i18n.t('label.lineage'),
    path: 'lineage',
    field: TabSpecificField.LINEAGE,
  },
  {
    name: i18n.t('label.custom-property-plural'),
    path: 'custom_properties',
  },
];

export const getCurrentMlModelTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'activity_feed':
      currentTab = 2;

      break;
    case 'details':
      currentTab = 3;

      break;
    case 'lineage':
      currentTab = 4;

      break;
    case 'custom_properties':
      currentTab = 5;

      break;

    case 'features':
      currentTab = 1;

      break;
  }

  return currentTab;
};

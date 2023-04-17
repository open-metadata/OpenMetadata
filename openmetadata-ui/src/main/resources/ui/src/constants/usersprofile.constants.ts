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

export const getUserCurrentTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'tasks':
      currentTab = 2;

      break;
    case 'mydata':
      currentTab = 3;

      break;
    case 'following':
      currentTab = 4;

      break;
    case 'activity':
    default:
      currentTab = 1;
  }

  return currentTab;
};

export const profileInfo = [
  {
    tab: 1,
    path: 'activity',
  },
  {
    tab: 2,
    path: 'tasks',
  },
  {
    tab: 3,
    path: 'mydata',
  },
  {
    tab: 4,
    path: 'following',
  },
];

export const USER_PROFILE_TABS = [
  {
    name: i18n.t('label.activity'),
    isProtected: false,
    position: 1,
  },
  {
    name: i18n.t('label.task-plural'),
    isProtected: false,
    position: 2,
  },
  {
    name: i18n.t('label.my-data'),
    isProtected: false,
    position: 3,
  },
  {
    name: i18n.t('label.following'),
    isProtected: false,
    position: 4,
  },
];

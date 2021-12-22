/*
 *  Copyright 2021 Collate
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

export const dashboardDetailsTabs = [
  {
    name: 'Details',
    path: 'details',
  },
  {
    name: 'Lineage',
    path: 'lineage',
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentDashboardTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'manage':
      currentTab = 3;

      break;

    case 'lineage':
      currentTab = 2;

      break;

    case 'details':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};

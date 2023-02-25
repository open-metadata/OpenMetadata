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

import {
  Dashboard,
  DashboardServiceType,
} from '../../../../generated/entity/data/dashboard';

const mockDate = new Date('2023-01-03');

export const mockDashboardEntityDetails: Dashboard = {
  id: '2edaff89-b1d4-47b6-a081-d72f08e1def9',
  name: 'deck.gl Demo',
  displayName: 'deck.gl Demo',
  fullyQualifiedName: 'sample_superset.10',
  description: '',
  version: 0.1,
  updatedAt: 1672627828951,
  updatedBy: 'admin',
  dashboardUrl: 'http://localhost:808/superset/dashboard/deck/',
  charts: [
    {
      id: 'eba9c260-4036-4c57-92fe-6c6e3d703bda',
      type: 'chart',
      name: '127',
      fullyQualifiedName: 'sample_superset.127',
      description: '',
      displayName: 'Are you an ethnic minority in your city?',
      deleted: false,
      href: 'http://openmetadata-server:8585/api/v1/charts/eba9c260-4036-4c57-92fe-6c6e3d703bda',
    },
  ],
  href: 'http://openmetadata-server:8585/api/v1/dashboards/2edaff89-b1d4-47b6-a081-d72f08e1def9',
  followers: [],
  service: {
    id: '38ae6d66-7086-4e00-b2d6-cabd2b951993',
    type: 'dashboardService',
    name: 'sample_superset',
    fullyQualifiedName: 'sample_superset',
    deleted: false,
    href: 'http://openmetadata-server:8585/api/v1/services/dashboardServices/38ae6d66-7086-4e00-b2d6-cabd2b951993',
  },
  serviceType: DashboardServiceType.Superset,
  usageSummary: {
    dailyStats: {
      count: 0,
      percentileRank: 0,
    },
    weeklyStats: {
      count: 0,
      percentileRank: 0,
    },
    monthlyStats: {
      count: 0,
      percentileRank: 0,
    },
    date: mockDate,
  },
  deleted: false,
  tags: [],
};

export const mockFetchChartsResponse = [
  {
    id: 'eba9c260-4036-4c57-92fe-6c6e3d703bda',
    name: '127',
    displayName: 'Are you an ethnic minority in your city?',
    fullyQualifiedName: 'sample_superset.127',
    description: '',
    version: 0.1,
    updatedAt: 1672627828742,
    updatedBy: 'admin',
    chartType: 'Other',
    chartUrl:
      'http://localhost:8088/superset/explore/?form_data=%7B%22slice_id%22%3A%20127%7D',
    href: 'http://localhost:8585/api/v1/charts/eba9c260-4036-4c57-92fe-6c6e3d703bda',
    tags: [],
    service: {
      id: '38ae6d66-7086-4e00-b2d6-cabd2b951993',
      type: 'dashboardService',
      name: 'sample_superset',
      fullyQualifiedName: 'sample_superset',
      deleted: false,
      href: 'http://localhost:8585/api/v1/services/dashboardServices/38ae6d66-7086-4e00-b2d6-cabd2b951993',
    },
    serviceType: 'Superset',
    deleted: false,
  },
];

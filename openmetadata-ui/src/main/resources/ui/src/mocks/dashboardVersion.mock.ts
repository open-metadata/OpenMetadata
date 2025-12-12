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
/* eslint-disable max-len */

import { DashboardVersionProp } from '../components/Dashboard/DashboardVersion/DashboardVersion.interface';
import { Dashboard, DashboardType } from '../generated/entity/data/dashboard';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { VersionData } from '../pages/EntityVersionPage/EntityVersionPage.component';
import { ENTITY_PERMISSIONS } from './Permissions.mock';
import {
  mockBackHandler,
  mockDomain,
  mockOwner,
  mockTier,
  mockVersionHandler,
} from './VersionCommon.mock';

export const mockDashboardData: Dashboard = {
  id: '4ee70a0c-6ec9-4c93-a91c-4a57d65bebc8',
  name: 'eta_predictions_performance',
  dashboardType: DashboardType.Dashboard,
  displayName: 'ETA Predictions Performance',
  fullyQualifiedName: 'sample_superset.eta_predictions_performance',
  description: 'test description',
  version: 0.3,
  updatedAt: 1649337873334,
  updatedBy: 'anonymous',
  project: 'workspace',
  sourceUrl:
    'http://localhost:808/superset/dashboard/eta_predictions_performance/',
  charts: [
    {
      id: '0698ab5d-a122-4b86-a6e5-d10bf3550bd7',
      type: 'chart',
      name: 'with_description',
      description: 'test',
      displayName: 'ETA Predictions Accuracy',
      deleted: false,
    },
    {
      id: '0698ab5d-a122-4b86-a6e5-d10bf3550bd6',
      type: 'chart',
      name: 'without_description',
      description: '',
      displayName: 'ETA Predictions Accuracy',
      deleted: false,
    },
  ],
  owners: [
    {
      id: '067319fd-fa77-4b55-b481-f438489b0931',
      type: 'user',
      name: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  ],
  tags: [],
  service: {
    id: 'b1e14bf6-9078-40d7-abf5-21a5fcb056bd',
    type: 'dashboardService',
    name: 'sample_superset',
    deleted: false,
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
    date: new Date('2023-12-01'),
  },

  changeDescription: {
    fieldsAdded: [
      {
        name: 'owner',
        newValue:
          '{"id":"067319fd-fa77-4b55-b481-f438489b0931","type":"user","name":"aaron_johnson0","displayName":"Aaron Johnson","deleted":false}',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.2,
  },
  deleted: false,
};

export const dashboardVersionProps: DashboardVersionProp = {
  version: '0.3',
  currentVersionData: mockDashboardData,
  isVersionLoading: false,
  owners: mockOwner,
  domains: [mockDomain],
  dataProducts: [],
  tier: mockTier,
  slashedDashboardName: [
    {
      name: 'sample_superset',
      url: '/service/dashboardServices/sample_superset',
      imgSrc: '/service-icon-superset.png',
    },
    {
      name: 'ETA Predictions Performance',
      url: '',
      activeTitle: true,
    },
  ],
  versionList: {
    entityType: 'dashboard',

    versions: [
      '{"id":"4ee70a0c-6ec9-4c93-a91c-4a57d65bebc8","name":"eta_predictions_performance","displayName":"ETA Predictions Performance","fullyQualifiedName":"sample_superset.eta_predictions_performance","description":"test description","version":0.3,"updatedAt":1649337873334,"updatedBy":"anonymous","sourceUrl":"http://localhost:808/superset/dashboard/eta_predictions_performance/","charts":[{"id":"0698ab5d-a122-4b86-a6e5-d10bf3550bd7","type":"chart","name":"sample_superset.210","description":"","displayName":"ETA Predictions Accuracy","deleted":false}],"owner":{"id":"067319fd-fa77-4b55-b481-f438489b0931","type":"user","name":"aaron_johnson0","displayName":"Aaron Johnson","deleted":false},"tags":[],"service":{"id":"b1e14bf6-9078-40d7-abf5-21a5fcb056bd","type":"dashboardService","name":"sample_superset","deleted":false},"serviceType":"Superset","changeDescription":{"fieldsAdded":[{"name":"owner","newValue":"{\\"id\\":\\"067319fd-fa77-4b55-b481-f438489b0931\\",\\"type\\":\\"user\\",\\"name\\":\\"aaron_johnson0\\",\\"displayName\\":\\"Aaron Johnson\\",\\"deleted\\":false}"}],"fieldsUpdated":[],"fieldsDeleted":[],"previousVersion":0.2},"deleted":false}',
      '{"id": "4ee70a0c-6ec9-4c93-a91c-4a57d65bebc8", "name": "eta_predictions_performance", "tags": [], "charts": [{"id": "0698ab5d-a122-4b86-a6e5-d10bf3550bd7", "name": "sample_superset.210", "type": "chart", "deleted": false, "description": "", "displayName": "ETA Predictions Accuracy"}], "deleted": false, "service": {"id": "b1e14bf6-9078-40d7-abf5-21a5fcb056bd", "name": "sample_superset", "type": "dashboardService", "deleted": false}, "version": 0.2, "updatedAt": 1649337730944, "updatedBy": "anonymous", "description": "test description", "displayName": "ETA Predictions Performance", "serviceType": "Superset", "sourceUrl": "http://localhost:808/superset/dashboard/eta_predictions_performance/", "changeDescription": {"fieldsAdded": [], "fieldsDeleted": [], "fieldsUpdated": [{"name": "description", "newValue": "test description", "oldValue": ""}], "previousVersion": 0.1}, "fullyQualifiedName": "sample_superset.eta_predictions_performance"}',
      '{"id": "4ee70a0c-6ec9-4c93-a91c-4a57d65bebc8", "name": "eta_predictions_performance", "tags": [], "charts": [{"id": "0698ab5d-a122-4b86-a6e5-d10bf3550bd7", "name": "sample_superset.210", "type": "chart", "deleted": false, "description": "", "displayName": "ETA Predictions Accuracy"}], "deleted": false, "service": {"id": "b1e14bf6-9078-40d7-abf5-21a5fcb056bd", "name": "sample_superset", "type": "dashboardService", "deleted": false}, "version": 0.1, "updatedAt": 1649329479303, "updatedBy": "anonymous", "description": "", "displayName": "ETA Predictions Performance", "serviceType": "Superset", "sourceUrl": "http://localhost:808/superset/dashboard/eta_predictions_performance/", "fullyQualifiedName": "sample_superset.eta_predictions_performance"}',
    ],
  },
  backHandler: mockBackHandler,
  versionHandler: mockVersionHandler,
  deleted: false,
  entityPermissions: ENTITY_PERMISSIONS,
};

export const mockTagChangeVersion = {
  id: '4ee70a0c-6ec9-4c93-a91c-4a57d65bebc8',
  description: 'test description',
  version: 0.4,
  updatedAt: 1649354506617,
  updatedBy: 'anonymous',
  sourceUrl:
    'http://localhost:808/superset/dashboard/eta_predictions_performance/',
  charts: [
    {
      id: '0698ab5d-a122-4b86-a6e5-d10bf3550bd7',
      type: 'chart',
      name: 'sample_superset.210',
      description: 'test',
      displayName: 'ETA Predictions Accuracy',
      deleted: false,
    },
  ],
  owners: [
    {
      id: '067319fd-fa77-4b55-b481-f438489b0931',
      type: 'user',
    },
  ],
  tags: [
    {
      tagFQN: 'PersonalData.Personal',
      description:
        'Data that can be used to directly or indirectly identify a person.',
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
    {
      tagFQN: 'Tier.Tier1',
      description:
        'Data that can be used to directly or indirectly identify a person.',
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
  ],
  service: {
    id: 'b1e14bf6-9078-40d7-abf5-21a5fcb056bd',
    type: 'dashboardService',
    name: 'sample_superset',
    deleted: false,
  },
  serviceType: 'Superset',
  changeDescription: {
    fieldsAdded: [
      {
        name: 'tags',
        newValue:
          '[{"tagFQN":"PersonalData.Personal","source":"Classification","labelType":"Manual","state":"Confirmed"}]',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.3,
  },
  deleted: false,
} as unknown as VersionData;

export const mockNoChartData = {
  id: '4ee70a0c-6ec9-4c93-a91c-4a57d65bebc8',
  description: 'test description',
  name: 'test',
  version: 0.4,
  updatedAt: 1649354506617,
  updatedBy: 'anonymous',
  sourceUrl:
    'http://localhost:808/superset/dashboard/eta_predictions_performance/',
  owners: [
    {
      id: '067319fd-fa77-4b55-b481-f438489b0931',
      type: 'user',
    },
  ],
  tags: [
    {
      tagFQN: 'PersonalData.Personal',
      description:
        'Data that can be used to directly or indirectly identify a person.',
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
    {
      tagFQN: 'Tier.Tier1',
      description:
        'Data that can be used to directly or indirectly identify a person.',
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
  ],
  service: {
    id: 'b1e14bf6-9078-40d7-abf5-21a5fcb056bd',
    type: 'dashboardService',
    name: 'sample_superset',
    deleted: false,
  },
  serviceType: 'Superset',
  changeDescription: {
    fieldsAdded: [
      {
        name: 'tags',
        newValue:
          '[{"tagFQN":"PersonalData.Personal","source":"Classification","labelType":"Manual","state":"Confirmed"}]',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.3,
  },
  deleted: false,
} as Dashboard;

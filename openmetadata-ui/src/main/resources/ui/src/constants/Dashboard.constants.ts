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
import {
  Dashboard,
  DashboardServiceType,
  DashboardType,
} from '../generated/entity/data/dashboard';
import {
  DashboardDataModel,
  DataModelType,
} from '../generated/entity/data/dashboardDataModel';
import { DataType } from '../generated/entity/data/table';

export const DASHBOARD_DATA_MODEL_DUMMY_DATA: DashboardDataModel = {
  id: '3519340b-7a36-45d1-abdf-348a5f1c582c',
  name: 'orders',
  displayName: 'Orders',
  fullyQualifiedName: 'sample_looker.model.orders',
  description: 'Orders explore from Sample Data',
  version: 0.1,
  updatedAt: 1697265260863,
  updatedBy: 'ingestion-bot',
  owners: [],
  dataProducts: [],
  tags: [],
  deleted: false,
  followers: [],
  service: {
    id: '2d102aaa-e683-425c-a8bf-e4afa43dde99',
    type: 'dashboardService',
    name: 'sample_looker',
    fullyQualifiedName: 'sample_looker',
    displayName: 'sample_looker',
    deleted: false,
  },
  serviceType: DashboardServiceType.Looker,
  dataModelType: DataModelType.LookMlExplore,
  // eslint-disable-next-line max-len
  sql: "SELECT CASE\n           WHEN stage_of_development = 'Pre-clinical' THEN '0. Pre-clinical'\n           WHEN stage_of_development = 'Phase I' THEN '1. Phase I'\n           WHEN stage_of_development = 'Phase I/II'\n                or stage_of_development = 'Phase II' THEN '2. Phase II or Combined I/II'\n           WHEN stage_of_development = 'Phase III' THEN '3. Phase III'\n           WHEN stage_of_development = 'Authorized' THEN '4. Authorized'\n       END AS clinical_stage,\n       COUNT(*) AS count\nFROM covid_vaccines\nGROUP BY CASE\n             WHEN stage_of_development = 'Pre-clinical' THEN '0. Pre-clinical'\n             WHEN stage_of_development = 'Phase I' THEN '1. Phase I'\n             WHEN stage_of_development = 'Phase I/II'\n                  or stage_of_development = 'Phase II' THEN '2. Phase II or Combined I/II'\n             WHEN stage_of_development = 'Phase III' THEN '3. Phase III'\n             WHEN stage_of_development = 'Authorized' THEN '4. Authorized'\n         END\nORDER BY count DESC\nLIMIT 10000\nOFFSET 0;\n",
  columns: [
    {
      name: '0. Pre-clinical',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: "Vaccine Candidates in phase: 'Pre-clinical'",
      fullyQualifiedName: 'sample_looker.model.orders."0. Pre-clinical"',
      tags: [],
      ordinalPosition: 1,
    },
    {
      name: '2. Phase II or Combined I/II',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: "Vaccine Candidates in phase: 'Phase II or Combined I/II'",
      fullyQualifiedName:
        'sample_looker.model.orders."2. Phase II or Combined I/II"',
      tags: [],
      ordinalPosition: 2,
    },
    {
      name: '1. Phase I',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: "Vaccine Candidates in phase: 'Phase I'",
      fullyQualifiedName: 'sample_looker.model.orders."1. Phase I"',
      tags: [],
      ordinalPosition: 3,
    },
    {
      name: '3. Phase III',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: "Vaccine Candidates in phase: 'Phase III'",
      fullyQualifiedName: 'sample_looker.model.orders."3. Phase III"',
      tags: [],
      ordinalPosition: 4,
    },
    {
      name: '4. Authorized',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: "Vaccine Candidates in phase: 'Authorize'",
      fullyQualifiedName: 'sample_looker.model.orders."4. Authorized"',
      tags: [],
      ordinalPosition: 5,
    },
  ],
  domains: [
    {
      id: '52fc9c67-78b7-42bf-8147-69278853c230',
      type: 'domain',
      name: 'Design',
      fullyQualifiedName: 'Design',
      description: "<p>Here' the description for Product Design</p>",
      displayName: 'Product Design ',
      inherited: true,
    },
  ],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};

export const DASHBOARD_DUMMY_DATA: Dashboard = {
  id: '21dd6360-d1f2-4810-8759-6ab92c4f033e',
  name: '31',
  displayName: 'Sales Dashboard',
  fullyQualifiedName: 'sample_superset.31',
  description: '',
  version: 0.1,
  updatedAt: 1743682276991,
  updatedBy: 'admin',
  dashboardType: DashboardType.Dashboard,
  sourceUrl: 'http://localhost:808/superset/dashboard/6/',
  charts: [
    {
      id: '7c3d1e8f-82f0-44c2-a00a-d721c0b88eb1',
      type: 'chart',
      name: '117',
      fullyQualifiedName: 'sample_superset.117',
      description: '',
      displayName: 'Age distribution of respondents',
      deleted: false,
    },
    {
      id: 'be02ba8d-3935-48aa-8daa-ef5e7ecb3534',
      type: 'chart',
      name: '166',
      fullyQualifiedName: 'sample_superset.166',
      description: '',
      displayName: '% Rural',
      deleted: false,
    },
    {
      id: '9b94f5fd-b16f-4d24-8ed5-60a9b67057ae',
      type: 'chart',
      name: '92',
      fullyQualifiedName: 'sample_superset.92',
      description: '',
      displayName: '✈️ Relocation ability',
      deleted: false,
    },
  ],
  owners: [],
  followers: [],
  tags: [],
  service: {
    id: '917a8613-8398-48e7-95dd-5e6c57027cc2',
    type: 'dashboardService',
    name: 'sample_superset',
    fullyQualifiedName: 'sample_superset',
    displayName: 'sample_superset',
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
    date: new Date('2025-04-03'),
  },
  deleted: false,
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};

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
  domain: {
    id: '52fc9c67-78b7-42bf-8147-69278853c230',
    type: 'domain',
    name: 'Design',
    fullyQualifiedName: 'Design',
    description: "<p>Here' the description for Product Design</p>",
    displayName: 'Product Design ',
    inherited: true,
  },
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};

export const DASHBOARD_DUMMY_DATA: Dashboard = {
  id: '574c383c-735f-44c8-abbb-355f87c8b19f',
  name: 'customers',
  displayName: 'Customers dashboard',
  fullyQualifiedName: 'SampleLookerService.customers',
  description: 'This is a sample Dashboard for Looker',
  version: 0.1,
  updatedAt: 1736493713236,
  updatedBy: 'admin',
  charts: [
    {
      id: '81cdc1f3-66ae-462f-bf3e-b5fbbfe7792f',
      type: 'chart',
      name: 'chart_1',
      fullyQualifiedName: 'SampleLookerService.chart_1',
      description: 'This is a sample Chart for Looker',
      displayName: 'Chart 1',
      deleted: false,
    },
    {
      id: '6f5057aa-8d7c-41a7-ab93-76bf8ed2bc27',
      type: 'chart',
      name: 'chart_2',
      fullyQualifiedName: 'SampleLookerService.chart_2',
      description: 'This is a sample Chart for Looker',
      displayName: 'Chart 2',
      deleted: false,
    },
  ],
  owners: [],
  followers: [],
  tags: [],
  service: {
    id: 'fb4df3ed-75b9-45d3-a2df-da07785893d7',
    type: 'dashboardService',
    name: 'SampleLookerService',
    fullyQualifiedName: 'SampleLookerService',
    displayName: 'SampleLookerService',
    deleted: false,
  },
  serviceType: DashboardServiceType.Looker,
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
    date: new Date('2025-02-03'),
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

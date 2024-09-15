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
  DashboardDataModel,
  DashboardServiceType,
  DataModelType,
  DataType,
} from '../generated/entity/data/dashboardDataModel';

export const MOCK_DASHBOARD_DATA_MODEL: DashboardDataModel = {
  id: '0625e04d-3517-4bd9-98aa-086100198bf8',
  name: 'orders_view',
  displayName: 'Orders View',
  fullyQualifiedName: 'sample_looker.model.orders_view',
  description: 'Orders View from Sample Data',
  version: 0.1,
  updatedAt: 1701253611743,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/dashboard/datamodels/0625e04d-3517-4bd9-98aa-086100198bf8',
  dataProducts: [],
  tags: [],
  deleted: false,
  followers: [],
  service: {
    id: '39f8eaf5-b211-4c36-bab6-7f11cf5ca624',
    type: 'dashboardService',
    name: 'sample_looker',
    fullyQualifiedName: 'sample_looker',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/dashboardServices/39f8eaf5-b211-4c36-bab6-7f11cf5ca624',
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
      fullyQualifiedName: 'sample_looker.model.orders_view."0. Pre-clinical"',
      tags: [],
      ordinalPosition: 1,
    },
    {
      name: '2. Phase II or Combined I/II',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: "Vaccine Candidates in phase: 'Phase II or Combined I/II'",
      fullyQualifiedName:
        'sample_looker.model.orders_view."2. Phase II or Combined I/II"',
      tags: [],
      ordinalPosition: 2,
    },
    {
      name: '1. Phase I',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: "Vaccine Candidates in phase: 'Phase I'",
      fullyQualifiedName: 'sample_looker.model.orders_view."1. Phase I"',
      tags: [],
      ordinalPosition: 3,
    },
    {
      name: '3. Phase III',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: "Vaccine Candidates in phase: 'Phase III'",
      fullyQualifiedName: 'sample_looker.model.orders_view."3. Phase III"',
      tags: [],
      ordinalPosition: 4,
    },
    {
      name: '4. Authorized',
      dataType: DataType.Numeric,
      dataTypeDisplay: 'numeric',
      description: "Vaccine Candidates in phase: 'Authorize'",
      fullyQualifiedName: 'sample_looker.model.orders_view."4. Authorized"',
      tags: [],
      ordinalPosition: 5,
    },
  ],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};

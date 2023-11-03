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

export const KPI_DATA = [
  {
    id: 'dabd01bb-095d-448e-af21-0427859b99b5',
    name: 'description-kpi',
    displayName: 'Description KPI',
    fullyQualifiedName: 'description-kpi',
    description: '',
    metricType: 'PERCENTAGE',
    targetDefinition: [
      {
        name: 'completedDescriptionFraction',
        value: '0.65',
      },
    ],
    startDate: 1670351400000,
    endDate: 1672165800000,
    version: 0.2,
    updatedAt: 1670414685805,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/kpi/dabd01bb-095d-448e-af21-0427859b99b5',
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [
        {
          name: 'startDate',
          oldValue: 1670395661000,
          newValue: 1670351400000,
        },
        {
          name: 'endDate',
          oldValue: 1672210072000,
          newValue: 1672165800000,
        },
      ],
      fieldsDeleted: [],
      previousVersion: 0.1,
    },
    deleted: false,
  },
  {
    id: 'bb71e000-f837-4e3c-8e03-0a0f1fd35667',
    name: 'owner-kpi-has-owner-fraction',
    displayName: 'Owner KPI',
    fullyQualifiedName: 'owner-kpi-has-owner-fraction',
    description: '',
    metricType: 'PERCENTAGE',
    targetDefinition: [
      {
        name: 'hasOwnerFraction',
        value: '0.64',
      },
    ],
    startDate: 1670351400000,
    endDate: 1672511340000,
    version: 0.2,
    updatedAt: 1670415195507,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/kpi/bb71e000-f837-4e3c-8e03-0a0f1fd35667',
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [
        {
          name: 'endDate',
          oldValue: 1672252140000,
          newValue: 1672511340000,
        },
      ],
      fieldsDeleted: [],
      previousVersion: 0.1,
    },
    deleted: false,
  },
];

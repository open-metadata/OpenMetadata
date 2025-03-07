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

import { KpiTargetType } from '../../generated/dataInsight/kpi/kpi';

export const KPI_LIST = [
  {
    id: 'dabd01bb-095d-448e-af21-0427859b99b5',
    name: 'description-kpi',
    displayName: 'Description KPI',
    fullyQualifiedName: 'description-kpi',
    description: '',
    metricType: KpiTargetType.Percentage,
    dataInsightChart: {
      id: '7dc794d3-1881-408c-92fc-6182aa453bc8',
      type: 'dataInsightChart',
      name: 'PercentageOfEntitiesWithDescriptionByType',
      fullyQualifiedName: 'PercentageOfEntitiesWithDescriptionByType',
      description:
        'Display the percentage of entities with description by type.',
      displayName: 'Percentage of Entities With Description',
      deleted: false,
      href: 'http://localhost:8585/api/v1/dataInsanalytics/dataInsights/chartsight/7dc794d3-1881-408c-92fc-6182aa453bc8',
    },
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
    targetValue: 58,
  },
];

export const KPI_DATA = {
  id: 'dabd01bb-095d-448e-af21-0427859b99b5',
  name: 'description-kpi',
  displayName: 'Description KPI',
  fullyQualifiedName: 'description-kpi',
  description: '',
  metricType: 'PERCENTAGE',
  dataInsightChart: {
    id: '7dc794d3-1881-408c-92fc-6182aa453bc8',
    type: 'dataInsightChart',
    name: 'PercentageOfEntitiesWithDescriptionByType',
    fullyQualifiedName: 'PercentageOfEntitiesWithDescriptionByType',
    description: 'Display the percentage of entities with description by type.',
    displayName: 'Percentage of Entities With Description',
    deleted: false,
    href: 'http://localhost:8585/api/v1/analytics/dataInsights/charts/7dc794d3-1881-408c-92fc-6182aa453bc8',
  },
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
};

export const MOCK_KPI_LIST_RESPONSE = {
  data: [
    {
      id: '17651e36-2350-414a-a68d-bea58cc96d02',
      name: 'description-percentage',
      displayName: 'description',
      fullyQualifiedName: 'description-percentage',
      description: 'this is description',
      metricType: 'PERCENTAGE',
      dataInsightChart: {
        id: 'e10d1bef-0d6b-42cd-a215-5771f40803eb',
        type: 'dataInsightCustomChart',
        name: 'percentage_of_data_asset_with_description_kpi',
        fullyQualifiedName: 'percentage_of_data_asset_with_description_kpi',
        displayName: 'percentage_of_data_asset_with_description_kpi',
        deleted: false,
        href: 'http://localhost:8585/api/v1/analytics/dataInsights/system/charts/e10d1bef-0d6b-42cd-a215-5771f40803eb',
      },
      targetValue: 58,
      startDate: 1724697000000,
      endDate: 1725128999999,
      version: 0.1,
      updatedAt: 1724760086039,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/kpi/17651e36-2350-414a-a68d-bea58cc96d02',
      deleted: false,
    },
  ],
  paging: {
    total: 1,
  },
};

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

export const KPI_CHARTS = [
  {
    id: 'd2f093d4-0ca8-42b8-8721-1c2a59951b59',
    name: 'dailyActiveUsers',
    displayName: 'Daily active users on the platform',
    fullyQualifiedName: 'dailyActiveUsers',
    description: 'Display the number of users active.',
    dataIndexType: 'web_analytic_user_activity_report_data_index',
    dimensions: [
      {
        name: 'timestamp',
        chartDataType: 'INT',
      },
    ],
    metrics: [
      {
        name: 'activeUsers',
        displayName: 'Number of active users',
        chartDataType: 'NUMBER',
      },
    ],
    version: 0.1,
    updatedAt: 1670231952802,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/dataInsight/d2f093d4-0ca8-42b8-8721-1c2a59951b59',
    deleted: false,
  },
  {
    id: 'fbad142d-16d5-479d-bed3-67bb5fd4104d',
    name: 'mostActiveUsers',
    displayName: 'Most Active Users',
    fullyQualifiedName: 'mostActiveUsers',
    description:
      'Displays the most active users on the platform based on page views.',
    dataIndexType: 'web_analytic_user_activity_report_data_index',
    dimensions: [
      {
        name: 'userName',
        chartDataType: 'STRING',
      },
      {
        name: 'team',
        chartDataType: 'STRING',
      },
    ],
    metrics: [
      {
        name: 'lastSession',
        displayName: 'Last time the user visited the platform',
        chartDataType: 'INT',
      },
      {
        name: 'sessions',
        displayName: 'Total number of sessions',
        chartDataType: 'INT',
      },
      {
        name: 'avgSessionDuration',
        displayName: 'The average duration time of a session',
        chartDataType: 'FLOAT',
      },
      {
        name: 'pageViews',
        displayName: 'Total number of page view',
        chartDataType: 'INT',
      },
    ],
    version: 0.1,
    updatedAt: 1670231952821,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/dataInsight/fbad142d-16d5-479d-bed3-67bb5fd4104d',
    deleted: false,
  },
  {
    id: '9217560a-3fed-4c0d-85fa-d7c699feefac',
    name: 'mostViewedEntities',
    displayName: 'Most Viewed entites',
    fullyQualifiedName: 'mostViewedEntities',
    description: 'Displays the most viewed entities.',
    dataIndexType: 'web_analytic_entity_view_report_data_index',
    dimensions: [
      {
        name: 'entityFqn',
        chartDataType: 'STRING',
      },
      {
        name: 'owner',
        chartDataType: 'STRING',
      },
    ],
    metrics: [
      {
        name: 'pageViews',
        displayName: 'Total number of page view',
        chartDataType: 'INT',
      },
    ],
    version: 0.1,
    updatedAt: 1670231952805,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/dataInsight/9217560a-3fed-4c0d-85fa-d7c699feefac',
    deleted: false,
  },
  {
    id: '73d9b934-7664-4e84-8a7e-7fa00fe03f5f',
    name: 'pageViewsByEntities',
    displayName: 'Page views by entities',
    fullyQualifiedName: 'pageViewsByEntities',
    description: 'Displays the number of time an entity type was viewed.',
    dataIndexType: 'web_analytic_entity_view_report_data_index',
    dimensions: [
      {
        name: 'timestamp',
        chartDataType: 'INT',
      },
      {
        name: 'entityType',
        chartDataType: 'INT',
      },
    ],
    metrics: [
      {
        name: 'pageViews',
        displayName: 'Total number of page view',
        chartDataType: 'INT',
      },
    ],
    version: 0.1,
    updatedAt: 1670231952798,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/dataInsight/73d9b934-7664-4e84-8a7e-7fa00fe03f5f',
    deleted: false,
  },
  {
    id: '7dc794d3-1881-408c-92fc-6182aa453bc8',
    name: 'PercentageOfEntitiesWithDescriptionByType',
    displayName: 'Percentage of Entities With Description',
    fullyQualifiedName: 'PercentageOfEntitiesWithDescriptionByType',
    description: 'Display the percentage of entities with description by type.',
    dataIndexType: 'entity_report_data_index',
    dimensions: [
      {
        name: 'timestamp',
        chartDataType: 'INT',
      },
      {
        name: 'entityType',
        displayName: 'Entity Type',
        chartDataType: 'STRING',
      },
    ],
    metrics: [
      {
        name: 'completedDescriptionFraction',
        displayName: 'Percentage of Completed Description',
        chartDataType: 'PERCENTAGE',
      },
      {
        name: 'completedDescription',
        displayName: 'Entities with Completed Description',
        chartDataType: 'NUMBER',
      },
      {
        name: 'entityCount',
        displayName: 'Total Entities',
        chartDataType: 'INT',
      },
    ],
    version: 0.1,
    updatedAt: 1670231952816,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/dataInsight/7dc794d3-1881-408c-92fc-6182aa453bc8',
    deleted: false,
  },
  {
    id: 'd712533a-ea8c-409f-a9e3-3f68d06d7864',
    name: 'PercentageOfEntitiesWithOwnerByType',
    displayName: 'Percentage of Entities With Owner',
    fullyQualifiedName: 'PercentageOfEntitiesWithOwnerByType',
    description: 'Display the percentage of entities with owner by type.',
    dataIndexType: 'entity_report_data_index',
    dimensions: [
      {
        name: 'timestamp',
        chartDataType: 'INT',
      },
      {
        name: 'entityType',
        displayName: 'Entity Type',
        chartDataType: 'STRING',
      },
    ],
    metrics: [
      {
        name: 'hasOwnerFraction',
        displayName: 'Percentage of Completed Owner',
        chartDataType: 'PERCENTAGE',
      },
      {
        name: 'hasOwner',
        displayName: 'Entities with Owner',
        chartDataType: 'NUMBER',
      },
      {
        name: 'entityCount',
        displayName: 'Total Entities',
        chartDataType: 'INT',
      },
    ],
    version: 0.1,
    updatedAt: 1670231952825,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/dataInsight/d712533a-ea8c-409f-a9e3-3f68d06d7864',
    deleted: false,
  },
  {
    id: '71d7f330-40d1-4c9e-b843-b5b62ff2efcd',
    name: 'TotalEntitiesByTier',
    displayName: 'Percentage of Entities With Tier',
    fullyQualifiedName: 'TotalEntitiesByTier',
    description: 'Display the percentage of entities with tier by type.',
    dataIndexType: 'entity_report_data_index',
    dimensions: [
      {
        name: 'timestamp',
        chartDataType: 'INT',
      },
      {
        name: 'entityTier',
        displayName: 'Entity Tier',
        chartDataType: 'STRING',
      },
    ],
    metrics: [
      {
        name: 'entityCountFraction',
        displayName: 'Total Count of Entity',
        chartDataType: 'PERCENTAGE',
      },
      {
        name: 'entityCount',
        displayName: 'Total Entities',
        chartDataType: 'NUMBER',
      },
    ],
    version: 0.1,
    updatedAt: 1670231952786,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/dataInsight/71d7f330-40d1-4c9e-b843-b5b62ff2efcd',
    deleted: false,
  },
  {
    id: 'd3eff37a-1196-4e4a-bc6a-5a81bb6504b5',
    name: 'TotalEntitiesByType',
    displayName: 'Total Entities',
    fullyQualifiedName: 'TotalEntitiesByType',
    description: 'Display the total of entities by type.',
    dataIndexType: 'entity_report_data_index',
    dimensions: [
      {
        name: 'timestamp',
        chartDataType: 'INT',
      },
      {
        name: 'entityType',
        displayName: 'Entity Tier',
        chartDataType: 'STRING',
      },
    ],
    metrics: [
      {
        name: 'entityCountFraction',
        displayName: 'Total Count of Entity',
        chartDataType: 'PERCENTAGE',
      },
      {
        name: 'entityCount',
        displayName: 'Total Entities',
        chartDataType: 'NUMBER',
      },
    ],
    version: 0.1,
    updatedAt: 1670231952810,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/dataInsight/d3eff37a-1196-4e4a-bc6a-5a81bb6504b5',
    deleted: false,
  },
];

export const KPI_LIST = [
  {
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
      description:
        'Display the percentage of entities with description by type.',
      displayName: 'Percentage of Entities With Description',
      deleted: false,
      href: 'http://localhost:8585/api/v1/dataInsight/7dc794d3-1881-408c-92fc-6182aa453bc8',
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
    href: 'http://localhost:8585/api/v1/dataInsight/7dc794d3-1881-408c-92fc-6182aa453bc8',
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

export const DESCRIPTION_CHART = {
  id: '7dc794d3-1881-408c-92fc-6182aa453bc8',
  name: 'PercentageOfEntitiesWithDescriptionByType',
  displayName: 'Percentage of Entities With Description',
  fullyQualifiedName: 'PercentageOfEntitiesWithDescriptionByType',
  description: 'Display the percentage of entities with description by type.',
  dataIndexType: 'entity_report_data_index',
  dimensions: [
    {
      name: 'timestamp',
      chartDataType: 'INT',
    },
    {
      name: 'entityType',
      displayName: 'Entity Type',
      chartDataType: 'STRING',
    },
  ],
  metrics: [
    {
      name: 'completedDescriptionFraction',
      displayName: 'Percentage of Completed Description',
      chartDataType: 'PERCENTAGE',
    },
    {
      name: 'completedDescription',
      displayName: 'Entities with Completed Description',
      chartDataType: 'NUMBER',
    },
    {
      name: 'entityCount',
      displayName: 'Total Entities',
      chartDataType: 'INT',
    },
  ],
  version: 0.1,
  updatedAt: 1670231952816,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/dataInsight/7dc794d3-1881-408c-92fc-6182aa453bc8',
  deleted: false,
};

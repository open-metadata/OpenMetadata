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

export const mockData = {
  description: '',
  href: 'link',
  id: 'd3b225a2-e4a2-4f4e-834e-b1c03112f139',
  jdbc: {
    connectionUrl:
      'postgresql+psycopg2://awsuser:focguC-kaqqe5-nepsok@redshift-cluster-1.clot5cqn1cnb.us-west-2.redshift.amazonaws.com:5439/warehouse',
    driverClass: 'jdbc',
  },
  name: 'aws_redshift',
  serviceType: 'Redshift',
  connection: {
    config: {
      username: 'test_user',
      password: 'test_pass',
    },
  },
};

export const mockDatabase = {
  data: [
    {
      description: ' ',
      fullyQualifiedName: 'aws_redshift.information_schema',
      href: 'http://localhost:8585/api/v1/databases/c86f4fed-f259-43d8-b031-1ce0b7dd4e41',
      id: 'c86f4fed-f259-43d8-b031-1ce0b7dd4e41',
      name: 'information_schema',
      service: {
        description: '',
        href: 'http://localhost:8585/api/v1/services/databaseServices/d3b225a2-e4a2-4f4e-834e-b1c03112f139',
        id: 'd3b225a2-e4a2-4f4e-834e-b1c03112f139',
        name: 'aws_redshift',
        type: 'databaseService',
      },
      usageSummary: {
        date: '2021-08-04',
        dailyStats: { count: 0, percentileRank: 0 },
        monthlyStats: { count: 0, percentileRank: 0 },
        weeklyStats: { count: 0, percentileRank: 0 },
      },
      owner: {
        id: '0ff251d7-f0ab-4892-96d9-35191f36bf8b',
        type: 'team',
        name: 'Compute',
        fullyQualifiedName: 'Compute',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/0ff251d7-f0ab-4892-96d9-35191f36bf8b',
      },
    },
  ],
  paging: {
    after: null,
    before: null,
  },
};

export const mockTabs = [
  {
    name: 'Databases',
    isProtected: false,
    position: 1,
    count: 1,
  },
  {
    name: 'Ingestions',
    isProtected: false,

    position: 2,
    count: 0,
  },
  {
    name: 'Connection',
    isProtected: false,
    isHidden: false,
    position: 3,
  },
];

export const DASHBOARD_DATA = [
  {
    id: '04d014be-e24b-40df-913b-c3d3e8c95548',
    name: '10',
    displayName: 'deck.gl Demo',
    fullyQualifiedName: 'sample_superset.10',
    description: 'Description.',
    version: 0.4,
    updatedAt: 1670841493940,
    updatedBy: 'sachin.c',
    dashboardUrl: 'http://localhost:808/superset/dashboard/deck/',
    href: 'http://sandbox-beta.open-metadata.org/api/v1/dashboards/04d014be-e24b-40df-913b-c3d3e8c95548',
    owner: {
      id: '0ff251d7-f0ab-4892-96d9-35191f36bf8b',
      type: 'team',
      name: 'Compute',
      fullyQualifiedName: 'Compute',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/0ff251d7-f0ab-4892-96d9-35191f36bf8b',
    },
    tags: [
      {
        tagFQN: 'PersonalData.SpecialCategory',
        description: 'GDPR',
        source: 'Tag',
        labelType: 'Manual',
        state: 'Confirmed',
      },
      {
        tagFQN: 'PII.None',
        description: 'Non PII',
        source: 'Tag',
        labelType: 'Manual',
        state: 'Confirmed',
      },
    ],
    service: {
      id: '2b9a4c6a-6dd1-43b1-b73e-434392f7e443',
      type: 'dashboardService',
      name: 'sample_superset',
      fullyQualifiedName: 'sample_superset',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/services/dashboardServices/2b9a4c6a-6dd1-43b1-b73e-434392f7e443',
    },
    serviceType: 'Superset',
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
      date: '2022-12-12',
    },
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [
        {
          name: 'description',
          oldValue: '',
          newValue: 'Description.',
        },
      ],
      fieldsDeleted: [],
      previousVersion: 0.3,
    },
    deleted: false,
  },
  {
    id: '0ab07868-b2da-4879-b29d-0977fac0c360',
    name: '11',
    displayName: 'FCC New Coder Survey 2018',
    fullyQualifiedName: 'sample_superset.11',
    description: '',
    version: 0.1,
    updatedAt: 1668510719495,
    updatedBy: 'ingestion-bot',
    dashboardUrl: 'http://localhost:808/superset/dashboard/7/',
    href: 'http://sandbox-beta.open-metadata.org/api/v1/dashboards/0ab07868-b2da-4879-b29d-0977fac0c360',
    tags: [],
    service: {
      id: '2b9a4c6a-6dd1-43b1-b73e-434392f7e443',
      type: 'dashboardService',
      name: 'sample_superset',
      fullyQualifiedName: 'sample_superset',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/services/dashboardServices/2b9a4c6a-6dd1-43b1-b73e-434392f7e443',
    },
    serviceType: 'Superset',
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
      date: '2022-12-12',
    },
    deleted: false,
  },
  {
    id: '359e20da-d8d5-4f68-9694-417b8b24c74d',
    name: '12',
    displayName: 'Misc Charts',
    fullyQualifiedName: 'sample_superset.12',
    description: '',
    version: 0.1,
    updatedAt: 1668510719649,
    updatedBy: 'ingestion-bot',
    dashboardUrl: 'http://localhost:808/superset/dashboard/misc_charts/',
    href: 'http://sandbox-beta.open-metadata.org/api/v1/dashboards/359e20da-d8d5-4f68-9694-417b8b24c74d',
    tags: [],
    service: {
      id: '2b9a4c6a-6dd1-43b1-b73e-434392f7e443',
      type: 'dashboardService',
      name: 'sample_superset',
      fullyQualifiedName: 'sample_superset',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/services/dashboardServices/2b9a4c6a-6dd1-43b1-b73e-434392f7e443',
    },
    serviceType: 'Superset',
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
      date: '2022-12-12',
    },
    deleted: false,
  },
];

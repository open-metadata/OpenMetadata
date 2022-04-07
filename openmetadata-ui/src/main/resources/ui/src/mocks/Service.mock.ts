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

export const mockServiceDetails = {
  data: [
    {
      collection: {
        documentation: 'Messaging service collection',
        href: 'http://messagingServices',
        name: 'messagingServices',
      },
    },
    {
      collection: {
        documentation: 'Database service collection',
        href: 'http://databaseServices',
        name: 'databaseServices',
      },
    },
    {
      collection: {
        documentation: 'Dashboard service collection',
        href: 'http://dashboardServices',
        name: 'dashboardServices',
      },
    },
    {
      collection: {
        name: 'pipelineServices',
        documentation: 'Pipeline service collection',
        href: 'http://pipelineServices',
      },
    },
  ],
};

export const mockDatabaseService = {
  data: {
    data: [
      {
        id: '847deda6-5342-42ed-b392-f0178a502c13',
        name: 'bigquery',
        serviceType: 'BigQuery',
        description: 'BigQuery service used for shopify data',
        href: 'http://localhost:8585/api/v1/services/databaseServices/847deda6-5342-42ed-b392-f0178a502c13',
        jdbc: {
          driverClass: 'jdbc',
          connectionUrl: 'jdbc://localhost',
        },
      },
      {
        id: '847deda6-5342-42ed-b392-f0178a502c13',
        name: 'mysql',
        serviceType: 'MySql',
        description: 'MySql service used for shopify data',
        href: 'http://localhost:8585/api/v1/services/databaseServices/847deda6-5342-42ed-b392-f0178a502c13',
        jdbc: {
          driverClass: 'jdbc',
          connectionUrl: 'jdbc://localhost',
        },
      },
    ],
    paging: { total: 2 },
  },
};

export const mockKafkaService = {
  connection: {
    config: {
      bootstrapServers: 'localhost:9092',
      schemaRegistryURL: 'http://localhost:8081',
      type: 'Kafka',
    },
  },
  href: 'http://localhost:8585/api/v1/services/messagingServices/473e2a9b-7555-42d3-904a-4c773c4dcd33',
  description: 'Kafka messaging queue service',
  id: '473e2a9b-7555-42d3-904a-4c773c4dcd33',
  name: 'sample_kafka',
  serviceType: 'Kafka',
};

export const mockPulsarService = {
  connection: {
    config: {
      type: 'Pulsar',
    },
  },
  description: 'Pulsar messaging queue service',
  href: 'http://localhost:8585/api/v1/services/messagingServices/473e2a9b-7555-42d3-904a-4c773c4dcd33',
  id: '473e2a9b-7555-42d3-904a-4c773c4dcd33',
  name: 'sample_pulsar',
  serviceType: 'Pulsar',
};

export const mockCustomMessagingService = {
  connection: {
    config: {
      type: 'Custom',
    },
  },
  description: 'Custom messaging queue service',
  href: 'http://localhost:8585/api/v1/services/messagingServices/473e2a9b-7555-42d3-904a-4c773c4dcd33',
  id: '473e2a9b-7555-42d3-904a-4c773c4dcd33',
  name: 'sample_custom',
  serviceType: 'Custom',
};

export const mockMessagingService = {
  data: {
    data: [mockKafkaService, mockPulsarService, mockCustomMessagingService],
    paging: { total: 3 },
  },
};

export const mockLookerService = {
  connection: {
    config: {
      url: 'http://localhost:8088',
      username: 'admin',
      password: 'admin',
      type: 'Looker',
    },
  },
  description: 'Looker Service',
  href: 'http://localhost:8585/api/v1/services/dashboardServices/627a0545-39bc-47d1-bde8-df8bf19b4616',
  id: '627a0545-39bc-47d1-bde8-df8bf19b4616',
  name: 'sample_looker',
  serviceType: 'Looker',
};

export const mockMetabaseService = {
  connection: {
    config: {
      hostPort: 'http://localhost:8088',
      username: 'admin',
      password: 'admin',
      type: 'Metabase',
    },
  },
  description: 'Metabase Service',
  href: 'http://localhost:8585/api/v1/services/dashboardServices/627a0545-39bc-47d1-bde8-df8bf19b4616',
  id: '627a0545-39bc-47d1-bde8-df8bf19b4616',
  name: 'sample_metabase',
  serviceType: 'Metabase',
};

export const mockPowerBIService = {
  connection: {
    config: {
      dashboardURL: 'http://localhost:8088',
      username: 'admin',
      password: 'admin',
      type: 'PowerBI',
    },
  },
  description: 'PowerBI Service',
  href: 'http://localhost:8585/api/v1/services/dashboardServices/627a0545-39bc-47d1-bde8-df8bf19b4616',
  id: '627a0545-39bc-47d1-bde8-df8bf19b4616',
  name: 'sample_powerbi',
  serviceType: 'PowerBI',
};

export const mockRedashService = {
  connection: {
    config: {
      redashURL: 'http://localhost:8088',
      username: 'admin',
      password: 'admin',
      type: 'Redash',
    },
  },
  description: 'Redash Service',
  href: 'http://localhost:8585/api/v1/services/dashboardServices/627a0545-39bc-47d1-bde8-df8bf19b4616',
  id: '627a0545-39bc-47d1-bde8-df8bf19b4616',
  name: 'sample_redash',
  serviceType: 'Redash',
};

export const mockSupersetService = {
  connection: {
    config: {
      supersetURL: 'http://localhost:8088',
      username: 'admin',
      password: 'admin',
      type: 'Superset',
    },
  },
  description: 'Supset Service',
  href: 'http://localhost:8585/api/v1/services/dashboardServices/627a0545-39bc-47d1-bde8-df8bf19b4616',
  id: '627a0545-39bc-47d1-bde8-df8bf19b4616',
  name: 'sample_superset',
  serviceType: 'Superset',
};

export const mockTableauService = {
  connection: {
    config: {
      siteURL: 'http://localhost:8088',
      username: 'admin',
      password: 'admin',
      type: 'Tableau',
    },
  },
  description: 'Tableau Service',
  href: 'http://localhost:8585/api/v1/services/dashboardServices/627a0545-39bc-47d1-bde8-df8bf19b4616',
  id: '627a0545-39bc-47d1-bde8-df8bf19b4616',
  name: 'sample_tableau',
  serviceType: 'Tableau',
};

export const mockCustomDashboardService = {
  connection: {
    config: {
      type: 'Custom',
    },
  },
  description: 'Custom Service',
  href: 'http://localhost:8585/api/v1/services/dashboardServices/627a0545-39bc-47d1-bde8-df8bf19b4616',
  id: '627a0545-39bc-47d1-bde8-df8bf19b4616',
  name: 'sample_custom',
  serviceType: 'Custom',
};

export const mockDashboardService = {
  data: {
    data: [
      mockLookerService,
      mockMetabaseService,
      mockPowerBIService,
      mockRedashService,
      mockSupersetService,
      mockTableauService,
      mockCustomDashboardService,
    ],
    paging: { total: 7 },
  },
};

export const mockPipelineService = {
  data: {
    data: [
      {
        id: '7576944e-2921-4c15-9edc-b9bada93338a',
        name: 'sample_airflow',
        serviceType: 'Airflow',
        description: 'Airflow service',
        version: 0.1,
        pipelineUrl: 'http://localhost:8080',
        href: 'http://localhost:8585/api/v1/services/pipelineServices/7576944e-2921-4c15-9edc-b9bada93338a',
      },
    ],
    paging: { total: 1 },
  },
};

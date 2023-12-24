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

import {
  DashboardService,
  DashboardServiceType,
} from '../generated/entity/services/dashboardService';
import {
  ConfigScheme,
  ConfigType,
  DatabaseService,
  DatabaseServiceType,
  LabelType,
  State,
  TagSource,
} from '../generated/entity/services/databaseService';
import {
  MessagingService,
  MessagingServiceType,
  SaslMechanismType,
} from '../generated/entity/services/messagingService';
import {
  MetadataService,
  MetadataServiceType,
  ProviderType,
} from '../generated/entity/services/metadataService';
import {
  MlmodelService,
  MlModelServiceType,
} from '../generated/entity/services/mlmodelService';
import {
  PipelineService,
  PipelineServiceType,
  Type,
} from '../generated/entity/services/pipelineService';
import {
  SearchService,
  SearchServiceType,
} from '../generated/entity/services/searchService';
import {
  StorageService,
  StorageServiceType,
} from '../generated/entity/services/storageService';

export const MOCK_CHANGE_DESCRIPTION = {
  fieldsAdded: [
    {
      name: 'tags',
      newValue:
        '[{"tagFQN":"PersonalData.SpecialCategory","source":"Classification","labelType":"Manual","state":"Confirmed"}]',
    },
  ],
  fieldsUpdated: [],
  fieldsDeleted: [],
  previousVersion: 1.2,
};

export const MOCK_DATABASE_SERVICE: DatabaseService = {
  id: '958a73c6-55d0-490f-8024-2a78a446d1db',
  name: 'sample_data',
  fullyQualifiedName: 'sample_data',
  displayName: 'Sample Data',
  serviceType: DatabaseServiceType.BigQuery,
  description: 'New Description',
  connection: {
    config: {
      type: ConfigType.BigQuery,
      scheme: ConfigScheme.Bigquery,
      hostPort: 'localhost:1234',
      credentials: {
        gcpConfig: {
          type: 'service_account',
          projectId: ['projectID'],
          privateKeyId: 'privateKeyId',
          privateKey: '*********',
          clientEmail: 'clientEmail',
          clientId: 'clientId',
          authUri: 'https://accounts.google.com/o/oauth2/auth',
          tokenUri: 'https://oauth2.googleapis.com/token',
          authProviderX509CertUrl: 'https://www.googleapis.com/oauth2/v1/certs',
          clientX509CertUrl: 'https://cert.url',
        },
      },
      taxonomyLocation: 'us',
      usageLocation: 'us',
      supportsMetadataExtraction: true,
      supportsUsageExtraction: true,
      supportsLineageExtraction: true,
      supportsDBTExtraction: true,
      supportsProfiler: true,
      supportsDatabase: true,
      supportsQueryComment: true,
    },
  },
  tags: [
    {
      tagFQN: 'BusinessGlossary.Term 2',
      description: 'Term 2',
      source: TagSource.Glossary,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
    {
      tagFQN: 'PersonalData.SpecialCategory',
      description:
        'GDPR special category data is personal information of data subjects that is especially sensitive.',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  version: 1.3,
  updatedAt: 1692781402793,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/services/databaseServices/958a73c6-55d0-490f-8024-2a78a446d1db',
  changeDescription: MOCK_CHANGE_DESCRIPTION,
  deleted: false,
};

export const MOCK_VERSIONS_LIST = {
  entityType: 'databaseService',
  versions: [
    `{"id":"958a73c6-55d0-490f-8024-2a78a446d1db","name":"sample_data","fullyQualifiedName":"sample_data","displayName":"Sample Data",
    "serviceType":"BigQuery","description":"New Description","connection":{"config":{"type":"BigQuery","scheme":"bigquery","hostPort":
    "localhost:1234","credentials":{"gcpConfig":{"type":"service_account","projectId":["projectID"],"privateKeyId":"privateKeyId",
    "privateKey":"*********","clientEmail":"clientEmail","clientId":"clientId","authUri":"https://accounts.google.com/o/oauth2/auth",
    "tokenUri":"https://oauth2.googleapis.com/token","authProviderX509CertUrl":"https://www.googleapis.com/oauth2/v1/certs",
    "clientX509CertUrl":"https://cert.url"}},"taxonomyLocation":"us","usageLocation":"us","supportsMetadataExtraction":true,
    "supportsUsageExtraction":true,"supportsLineageExtraction":true,"supportsDBTExtraction":true,"supportsProfiler":true,
    "supportsDatabase":true,"supportsQueryComment":true}},"tags":[{"tagFQN":"BusinessGlossary.Term 2","description":"Term 2",
    "source":"Glossary","labelType":"Manual","state":"Confirmed"},{"tagFQN":"PersonalData.SpecialCategory","description":"GDPR special 
    category data is personal information of data subjects that is especially sensitive, the exposure of which could significantly impact
     the rights and freedoms of data subjects and potentially be used against them for unlawful discrimination.","source":"Classification",
     "labelType":"Manual","state":"Confirmed"}],"version":1.3,"updatedAt":1692781402793,"updatedBy":"admin","changeDescription":{"fieldsAdded"
     :[{"name":"tags","newValue":"[{\\"tagFQN\\":\\"PersonalData.SpecialCategory\\",\\"source\\":\\"Classification\\",\\"labelType\\":\\
     "Manual\\",\\"state\\":\\"Confirmed\\"}]"}],"fieldsUpdated":[],"fieldsDeleted":[],"previousVersion":1.2},"deleted":false}`,
    `{"id":"958a73c6-55d0-490f-8024-2a78a446d1db","name":"sample_data","fullyQualifiedName":"sample_data","displayName":"Sample Data",
    "serviceType":"BigQuery","description":"New Description","connection":{"config":{"type":"BigQuery","scheme":"bigquery","hostPort":
    "localhost:1234","credentials":{"gcpConfig":{"type":"service_account","projectId":["projectID"],"privateKeyId":"privateKeyId","privateKey
    ":"*********","clientEmail":"clientEmail","clientId":"clientId","authUri":"https://accounts.google.com/o/oauth2/auth","tokenUri":
    "https://oauth2.googleapis.com/token","authProviderX509CertUrl":"https://www.googleapis.com/oauth2/v1/certs","clientX509CertUrl":
    "https://cert.url"}},"taxonomyLocation":"us","usageLocation":"us","supportsMetadataExtraction":true,"supportsUsageExtraction":true,
    "supportsLineageExtraction":true,"supportsDBTExtraction":true,"supportsProfiler":true,"supportsDatabase":true,"supportsQueryComment":true}}
    ,"tags":[{"tagFQN":"BusinessGlossary.Term 2","description":"Term 2","source":"Glossary","labelType":"Manual","state":"Confirmed"}],
    "version":1.2,"updatedAt":1692781391337,"updatedBy":"admin","changeDescription":{"fieldsAdded":[{"name":"tags","newValue":"
    [{\\"tagFQN\\":\\"BusinessGlossary.Term 2\\",\\"source\\":\\"Glossary\\",\\"labelType\\":\\"Manual\\",\\"state\\":\\"Confirmed\\"}]"}],
    "fieldsUpdated":[],"fieldsDeleted":[],"previousVersion":1.1},"deleted":false}`,
    `{"id":"958a73c6-55d0-490f-8024-2a78a446d1db","name":"sample_data","fullyQualifiedName":"sample_data","displayName":"Sample Data",
    "serviceType":"BigQuery","description":"New Description","connection":{"config":{"type":"BigQuery","scheme":"bigquery","hostPort":
    "localhost:1234","credentials":{"gcpConfig":{"type":"service_account","projectId":["projectID"],"privateKeyId":"privateKeyId",
    "privateKey":"*********","clientEmail":"clientEmail","clientId":"clientId","authUri":"https://accounts.google.com/o/oauth2/auth",
    "tokenUri":"https://oauth2.googleapis.com/token","authProviderX509CertUrl":"https://www.googleapis.com/oauth2/v1/certs",
    "clientX509CertUrl":"https://cert.url"}},"taxonomyLocation":"us","usageLocation":"us","supportsMetadataExtraction":true,
    "supportsUsageExtraction":true,"supportsLineageExtraction":true,"supportsDBTExtraction":true,"supportsProfiler":true,"supportsDatabase"
    :true,"supportsQueryComment":true}},"tags":[],"version":1.1,"updatedAt":1692780888264,"updatedBy":"admin","changeDescription":
    {"fieldsAdded":[],"fieldsUpdated":[{"name":"description","oldValue":"New Description updated","newValue":"New Description"}],
    "fieldsDeleted":[],"previousVersion":1.0},"deleted":false}`,
    `{"id":"958a73c6-55d0-490f-8024-2a78a446d1db","name":"sample_data","fullyQualifiedName":"sample_data","displayName":
    "Sample Data","serviceType":"BigQuery","description":"New Description updated","connection":{"config":{"type":"BigQuery","scheme":
    "bigquery","hostPort":"localhost:1234","credentials":{"gcpConfig":{"type":"service_account","projectId":["projectID"],"privateKeyId":
    "privateKeyId","privateKey":"*********","clientEmail":"clientEmail","clientId":"clientId","authUri":
    "https://accounts.google.com/o/oauth2/auth","tokenUri":"https://oauth2.googleapis.com/token","authProviderX509CertUrl":
    "https://www.googleapis.com/oauth2/v1/certs","clientX509CertUrl":"https://cert.url"}},"taxonomyLocation":"us","usageLocation":
    "us","supportsMetadataExtraction":true,"supportsUsageExtraction":true,"supportsLineageExtraction":true,"supportsDBTExtraction":true,
    "supportsProfiler":true,"supportsDatabase":true,"supportsQueryComment":true}},"tags":[],"version":1.0,"updatedAt":1692778636076,
    "updatedBy":"admin","changeDescription":{"fieldsAdded":[],"fieldsUpdated":[],"fieldsDeleted":[{"name":"tags","oldValue":"[{\\"tagFQN\\
    ":\\"PersonalData.SpecialCategory\\",\\"description\\":\\"GDPR special category data is personal information of data subjects that is 
    especially sensitive, the exposure of which could significantly impact the rights and freedoms of data subjects and potentially be used
     against them for unlawful discrimination.\\",\\"source\\":\\"Classification\\",\\"labelType\\":\\"Manual\\",\\"state\\":\\"Confirmed\\"}]
     "}],"previousVersion":0.9},"deleted":false}`,
  ],
};

export const MOCK_MESSAGING_SERVICE: MessagingService = {
  id: '383ab441-718e-4085-9442-acc3719ea207',
  name: 'sample_kafka',
  fullyQualifiedName: 'sample_kafka',
  serviceType: MessagingServiceType.Kafka,
  connection: {
    config: {
      type: MessagingServiceType.Kafka,
      bootstrapServers: 'localhost:9092',
      saslMechanism: SaslMechanismType.Plain,
      consumerConfig: {},
      schemaRegistryConfig: {},
      supportsMetadataExtraction: true,
    },
  },
  tags: [],
  version: 0.1,
  updatedAt: 1701253566933,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/services/messagingServices/383ab441-718e-4085-9442-acc3719ea207',
  deleted: false,
};

export const MOCK_DASHBOARD_SERVICE: DashboardService = {
  id: '39f8eaf5-b211-4c36-bab6-7f11cf5ca624',
  name: 'sample_looker',
  fullyQualifiedName: 'sample_looker',
  serviceType: DashboardServiceType.Looker,
  connection: {
    config: {
      type: DashboardServiceType.Looker,
      clientId: 'admin',
      clientSecret: '*********',
      hostPort: 'https://looker.com',
      supportsMetadataExtraction: true,
    },
  },
  tags: [],
  version: 0.1,
  updatedAt: 1701253567490,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/services/dashboardServices/39f8eaf5-b211-4c36-bab6-7f11cf5ca624',
  deleted: false,
};

export const MOCK_PIPLELINE_SERVICE: PipelineService = {
  id: '676d0760-e9d9-4113-9805-17aa0d1b1aa3',
  name: 'sample_airflow',
  fullyQualifiedName: 'sample_airflow',
  serviceType: PipelineServiceType.Airflow,
  version: 0.1,
  updatedAt: 1701253568540,
  updatedBy: 'admin',
  tags: [],
  connection: {
    config: {
      type: PipelineServiceType.Airflow,
      hostPort: 'http://localhost:8080',
      numberOfStatus: 10,
      connection: {
        type: Type.Backend,
      },
      supportsMetadataExtraction: true,
    },
  },
  href: 'http://localhost:8585/api/v1/services/pipelineServices/676d0760-e9d9-4113-9805-17aa0d1b1aa3',
  deleted: false,
};

export const MOCK_ML_MODEL_SERVICE: MlmodelService = {
  id: 'd1ddac6f-1b86-4e6a-8860-e5cef39789e6',
  name: 'mlflow_svc',
  fullyQualifiedName: 'mlflow_svc',
  serviceType: MlModelServiceType.Mlflow,
  version: 0.1,
  updatedAt: 1701253568982,
  updatedBy: 'admin',
  connection: {
    config: {
      type: MlModelServiceType.Mlflow,
      trackingUri: 'http://localhost:8088',
      registryUri: 'http://localhost:8088',
      supportsMetadataExtraction: true,
    },
  },
  tags: [],
  href: 'http://localhost:8585/api/v1/services/mlmodelServices/d1ddac6f-1b86-4e6a-8860-e5cef39789e6',
  deleted: false,
};

export const MOCK_STORAGE_SERVICE: StorageService = {
  id: 'aa436818-4e40-451b-8ae8-7a8a4f69f983',
  name: 's3_storage_sample',
  fullyQualifiedName: 's3_storage_sample',
  serviceType: StorageServiceType.S3,
  connection: {
    config: {
      type: StorageServiceType.S3,
      awsConfig: {
        awsAccessKeyId: 'aws_access_key_id',
        awsSecretAccessKey: '*********',
        awsRegion: 'awsRegion',
        endPointURL: 'https://endpoint.com/',
        assumeRoleSessionName: 'OpenMetadataSession',
      },
      supportsMetadataExtraction: true,
    },
  },
  tags: [],
  version: 0.1,
  updatedAt: 1701253569692,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/services/storageServices/aa436818-4e40-451b-8ae8-7a8a4f69f983',
  deleted: false,
};

export const MOCK_SEARCH_SERVICE: SearchService = {
  id: '49aa3625-f897-41f0-887b-d1fcc7c9e415',
  name: 'elasticsearch_sample',
  fullyQualifiedName: 'elasticsearch_sample',
  serviceType: SearchServiceType.ElasticSearch,
  connection: {
    config: {
      type: SearchServiceType.ElasticSearch,
      hostPort: 'http://localhost:9200',
      connectionTimeoutSecs: 30,
      supportsMetadataExtraction: true,
    },
  },
  tags: [],
  version: 0.1,
  updatedAt: 1701253570145,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/services/storageServices/49aa3625-f897-41f0-887b-d1fcc7c9e415',
  deleted: false,
};

export const MOCK_METADATA_SERVICE: MetadataService = {
  id: '9b09f404-7713-4f04-b7db-95111bac0c59',
  name: 'acsasc',
  fullyQualifiedName: 'acsasc',
  serviceType: MetadataServiceType.Atlas,
  description: '',
  connection: {
    config: {
      type: MetadataServiceType.Atlas,
      username: 'admin',
      password: '*********',
      hostPort: 'http://ec2-3-15-17-164.us-east-2.compute.amazonaws.com:21000',
      databaseServiceName: ['local_hive_new'],
      messagingServiceName: [],
      entity_type: 'hive_table',
      supportsMetadataExtraction: true,
    },
  },
  version: 0.3,
  updatedAt: 1698077526246,
  updatedBy: 'mayur',
  tags: [],
  owner: {
    id: '7a12b462-36c7-488a-b4c2-9756918704cb',
    type: 'user',
    name: 'mayur',
    fullyQualifiedName: 'mayur',
    displayName: 'Mayur Singal',
    deleted: false,
    href: 'http://sandbox-beta.open-metadata.org/api/v1/users/7a12b462-36c7-488a-b4c2-9756918704cb',
  },
  href: 'http://sandbox-beta.open-metadata.org/api/v1/services/databaseServices/9b09f404-7713-4f04-b7db-95111bac0c59',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'connection',
        oldValue: '"old-encrypted-value"',
        newValue: '"new-encrypted-value"',
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.2,
  },
  deleted: false,
  provider: ProviderType.User,
};

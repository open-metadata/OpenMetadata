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
  ConfigScheme,
  ConfigType,
  DatabaseService,
  DatabaseServiceType,
  LabelType,
  State,
  TagSource,
} from '../generated/entity/services/databaseService';

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

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
  DatabaseServiceType,
  LabelType,
  State,
  TagSource,
} from '../generated/entity/data/storedProcedure';

export const mockStoredProcedureData = [
  {
    id: 'de9c83b5-c37a-4d0a-a7aa-6bab1835bc1b',
    name: 'update_dim_address_table',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.update_dim_address_table',
    description: 'This stored procedure updates dim_address table',
    storedProcedureCode: {
      code: 'CREATE OR REPLACE PROCEDURE output_message(message VARCHAR)\nRETURNS VARCHAR NOT NULL\nLANGUAGE SQL\nAS\n$$\nBEGIN\n  RETURN message;\nEND;\n$$\n;',
    },
    version: 3.4,
    updatedAt: 1693892749147,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/storedProcedures/de9c83b5-c37a-4d0a-a7aa-6bab1835bc1b',
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [
        {
          name: 'description',
          oldValue: 'This stored procedure updates dim_address table.',
          newValue: 'This stored procedure updates dim_address table',
        },
        {
          name: 'storedProcedureCode',
          oldValue: {
            code: 'CREATE OR REPLACE PROCEDURE output_message(message VARCHAR)\nRETURNS VARCHAR NOT NULL\nLANGUAGE SQL\nAS\n$$\nBEGIN\n  RETURN message;\nEND;\n$$\n RETURN message;\nEND;\n$$\n;',
          },
          newValue: {
            code: 'CREATE OR REPLACE PROCEDURE output_message(message VARCHAR)\nRETURNS VARCHAR NOT NULL\nLANGUAGE SQL\nAS\n$$\nBEGIN\n  RETURN message;\nEND;\n$$\n;',
          },
        },
      ],
      fieldsDeleted: [],
      previousVersion: 3.3,
    },
    databaseSchema: {
      id: '48261b8c-4c99-4c5d-9ec7-cb758cc9f9c1',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      deleted: false,
      href: 'http://localhost:8585/api/v1/databaseSchemas/48261b8c-4c99-4c5d-9ec7-cb758cc9f9c1',
    },
    database: {
      id: 'd500add1-f101-4d1a-a9b8-01c72eb81904',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      deleted: false,
      href: 'http://localhost:8585/api/v1/databases/d500add1-f101-4d1a-a9b8-01c72eb81904',
    },
    service: {
      id: 'd610e9be-3a1d-4fb9-bc01-8bc95ef96170',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      deleted: false,
      href: 'http://localhost:8585/api/v1/services/databaseServices/d610e9be-3a1d-4fb9-bc01-8bc95ef96170',
    },
    serviceType: DatabaseServiceType.CustomDatabase,
    deleted: false,
    followers: [],
    tags: [
      {
        tagFQN: 'PersonalData.Personal',
        description:
          'Data that can be used to directly or indirectly identify a person.',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'PII.NonSensitive',
        description:
          'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'Tier.Tier3',
        description: `**Department/group level datasets that are typically non-business and general internal 
            system**\n\n- Used in product metrics, and dashboards to drive product decisions\n\n- Used 
            to track operational metrics of internal systems\n\n- Source used to derive other critical Tier-3 datasets`,
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
  },
  {
    id: 'b6ca035b-7786-41dc-83b9-d75a7de20199',
    name: 'update_orders_table',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.update_orders_table',
    description:
      'This stored procedure is written java script to update the orders table',
    storedProcedureCode: {
      code: `create or replace procedure read_result_set()\n  returns float not null\n  language
         javascript\n  as     \n  $$  \n    var my_sql_command = "select * from table1";\n   
          var statement1 = snowflake.createStatement( {sqlText: my_sql_command} );\n    var result_set1 =
           statement1.execute();\n    // Loop through the results, processing one row at a time... \n  
           while (result_set1.next())  {\n       var column1 = result_set1.getColumnValue(1);\n 
                    var column2 = result_set1.getColumnValue(2);\n       // Do something with the retrieved values...\n  
               }\n  return 0.0; // Replace with something more useful.\n  $$\n  ;`,
    },
    version: 0.8,
    updatedAt: 1693577191456,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/storedProcedures/b6ca035b-7786-41dc-83b9-d75a7de20199',
    changeDescription: {
      fieldsAdded: [
        {
          name: 'tags',
          newValue:
            '[{"tagFQN":"PII.Sensitive","source":"Classification","labelType":"Manual","state":"Confirmed"}]',
        },
      ],
      fieldsUpdated: [],
      fieldsDeleted: [],
      previousVersion: 0.7,
    },
    databaseSchema: {
      id: '48261b8c-4c99-4c5d-9ec7-cb758cc9f9c1',
      type: 'databaseSchema',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      deleted: false,
      href: 'http://localhost:8585/api/v1/databaseSchemas/48261b8c-4c99-4c5d-9ec7-cb758cc9f9c1',
    },
    database: {
      id: 'd500add1-f101-4d1a-a9b8-01c72eb81904',
      type: 'database',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      deleted: false,
      href: 'http://localhost:8585/api/v1/databases/d500add1-f101-4d1a-a9b8-01c72eb81904',
    },
    service: {
      id: 'd610e9be-3a1d-4fb9-bc01-8bc95ef96170',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      deleted: false,
      href: 'http://localhost:8585/api/v1/services/databaseServices/d610e9be-3a1d-4fb9-bc01-8bc95ef96170',
    },
    serviceType: DatabaseServiceType.CustomDatabase,
    deleted: false,
    owner: {
      id: '306ac549-7804-4695-9b1a-f0730a1fb809',
      type: 'team',
      name: 'Compute',
      fullyQualifiedName: 'Compute',
      deleted: false,
      href: 'http://localhost:8585/api/v1/teams/306ac549-7804-4695-9b1a-f0730a1fb809',
    },
    followers: [
      {
        id: 'bdd9b364-7905-48d8-8a06-50bab8d372ef',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/bdd9b364-7905-48d8-8a06-50bab8d372ef',
      },
    ],
    tags: [
      {
        tagFQN: 'PII.Sensitive',
        description:
          'PII which if lost, compromised, or disclosed without authorization, could result in substantial harm, embarrassment, inconvenience, or unfairness to an individual.',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'Tier.Tier3',
        description: `**Department/group level datasets that are typically non-business and general internal 
            system**\n\n- Used in product metrics, and dashboards to drive product decisions\n\n- 
            Used to track operational metrics of internal systems\n\n- Source used to derive other critical Tier-3 datasets`,
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
  },
];

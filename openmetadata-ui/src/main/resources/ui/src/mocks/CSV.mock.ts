/*
 *  Copyright 2024 Collate.
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
/* eslint-disable max-len */

import { ExtensionDataProps } from '../components/Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import { Category, Type } from '../generated/entity/type';
import { EntityReference } from '../generated/tests/testCase';

export const MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_EXTENSION_CSV_STRING = `dateCp:2024-09-18;dateTimeCp:15-09-2024 22:09:57;durationCp:PH23723D;emailCp:john.david@email.com;expert:user:"aaron.singh2";expertListPanel:databaseSchema:Glue.default.information_schema|glossaryTerm:"PW%40606600.Quick073437a4"."PW.ec0bbdf3%Bear5c6a56cc"|dashboard:sample_superset.11|user:angel_smith0|team:Legal Admin|user:anna_parker9;integerCp:2244;"markdownCp:# Project Title

## Overview
This project is designed to **simplify** and *automate* daily tasks. It aims to:
- Increase productivity
- Reduce manual effort
- Provide real-time data insights

## Features
1. **Task Management**: Organize tasks efficiently with custom tags.
2. **Real-Time Analytics**: Get up-to-date insights on task progress.
3. **Automation**: Automate repetitive workflows using custom scripts.

## Installation
To install the project, follow these steps:

1. Clone the repository:
";multiEnumCp:multiCp1;numberCp:4422;singleEnumCp:single1;"sqlQueryCp:SELECT * FROM ALL_DATA;";"stringCp:select * from table where id="23";;";timeCp:03:04:06;timerIntervalCp:1727532807278:1727532820197;timeStampCp:1727532807278`;

export const MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_CONVERTED_EXTENSION_CSV_STRING = `dateCp:2024-09-18;dateTimeCp:15-09-2024 22:09:57;durationCp:PH23723D;emailCp:john.david@email.com;expert:user:"aaron.singh2";expertListPanel:databaseSchema:Glue.default.information_schema|glossaryTerm:"PW%40606600.Quick073437a4"."PW.ec0bbdf3%Bear5c6a56cc"|dashboard:sample_superset.11|user:angel_smith0|team:Legal Admin|user:anna_parker9;integerCp:2244;"markdownCp:# Project Title

## Overview
This project is designed to **simplify** and *automate* daily tasks. It aims to:
- Increase productivity
- Reduce manual effort
- Provide real-time data insights

## Features
1. **Task Management**: Organize tasks efficiently with custom tags.
2. **Real-Time Analytics**: Get up-to-date insights on task progress.
3. **Automation**: Automate repetitive workflows using custom scripts.

## Installation
To install the project, follow these steps:

1. Clone the repository:";multiEnumCp:multiCp1;numberCp:4422;singleEnumCp:single1;"sqlQueryCp:SELECT * FROM ALL_DATA;";"stringCp:select * from table where id="23";;";timeCp:03:04:06;timerIntervalCp:1727532807278:1727532820197;timeStampCp:1727532807278`;

export const MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES_EXTENSION_OBJECT: ExtensionDataProps =
  {
    dateCp: '2024-09-18',
    dateTimeCp: '15-09-2024 22:09:57',
    durationCp: 'PH23723D',
    emailCp: 'john.david@email.com',
    expert: {
      type: 'user',
      fullyQualifiedName: '"aaron.singh2"',
      name: 'aaron.singh2',
    } as EntityReference,
    expertListPanel: [
      {
        fullyQualifiedName: 'Glue.default.information_schema',
        name: 'Glue.default.information_schema',
        type: 'databaseSchema',
      } as EntityReference,
      {
        fullyQualifiedName:
          '"PW%40606600.Quick073437a4"."PW.ec0bbdf3%Bear5c6a56cc"',
        name: 'PW%40606600.Quick073437a4"."PW.ec0bbdf3%Bear5c6a56cc',
        type: 'glossaryTerm',
      } as EntityReference,
      {
        fullyQualifiedName: 'sample_superset.11',
        name: 'sample_superset.11',
        type: 'dashboard',
      } as EntityReference,
      {
        fullyQualifiedName: 'angel_smith0',
        name: 'angel_smith0',
        type: 'user',
      } as EntityReference,
      {
        fullyQualifiedName: 'Legal Admin',
        name: 'Legal Admin',
        type: 'team',
      } as EntityReference,
      {
        fullyQualifiedName: 'anna_parker9',
        name: 'anna_parker9',
        type: 'user',
      } as EntityReference,
    ],
    integerCp: '2244',
    markdownCp:
      '# Project Title\n' +
      '\n' +
      '## Overview\n' +
      'This project is designed to **simplify** and *automate* daily tasks. It aims to:\n' +
      '- Increase productivity\n' +
      '- Reduce manual effort\n' +
      '- Provide real-time data insights\n' +
      '\n' +
      '## Features\n' +
      '1. **Task Management**: Organize tasks efficiently with custom tags.\n' +
      '2. **Real-Time Analytics**: Get up-to-date insights on task progress.\n' +
      '3. **Automation**: Automate repetitive workflows using custom scripts.\n' +
      '\n' +
      '## Installation\n' +
      'To install the project, follow these steps:\n' +
      '\n' +
      '1. Clone the repository:',
    multiEnumCp: ['multiCp1'],
    numberCp: '4422',
    singleEnumCp: ['single1'],
    sqlQueryCp: 'SELECT * FROM ALL_DATA;',
    stringCp: 'select * from table where id="23";;',
    timeCp: '03:04:06',
    timerIntervalCp: {
      end: 1727532820197,
      start: 1727532807278,
    },
    timeStampCp: '1727532807278',
  };

export const MOCK_GLOSSARY_TERM_CUSTOM_PROPERTIES: Type = {
  id: '84b20f4c-6d7d-4294-a7d4-2f8adcbcdbf8',
  name: 'glossaryTerm',
  fullyQualifiedName: 'glossaryTerm',
  displayName: 'glossaryTerm',
  description: '"This schema defines te Glossary term entities."',
  category: Category.Entity,
  nameSpace: 'data',
  schema: '',
  customProperties: [
    {
      name: 'dateCp',
      description: 'dateCp',
      propertyType: {
        id: '2a960268-51dc-45aa-9c6b-217f62552a77',
        type: 'type',
        name: 'date-cp',
        fullyQualifiedName: 'date-cp',
        description: '"Date as defined in custom property."',
        displayName: 'date-cp',
        href: 'http://localhost:8585/api/v1/metadata/types/2a960268-51dc-45aa-9c6b-217f62552a77',
      },
      customPropertyConfig: {
        config: 'yyyy-MM-dd',
      },
    },
    {
      name: 'dateTimeCp',
      description: 'dateTimeCp',
      propertyType: {
        id: '8b17270b-4191-41cc-971b-4d5baaa8791a',
        type: 'type',
        name: 'dateTime-cp',
        fullyQualifiedName: 'dateTime-cp',
        description: '"Date and time as defined in custom property."',
        displayName: 'dateTime-cp',
        href: 'http://localhost:8585/api/v1/metadata/types/8b17270b-4191-41cc-971b-4d5baaa8791a',
      },
      customPropertyConfig: {
        config: 'dd-MM-yyyy HH:mm:ss',
      },
    },
    {
      name: 'durationCp',
      description: 'durationCp',
      propertyType: {
        id: '21dc01b3-5dd5-4534-a72c-a8badc519954',
        type: 'type',
        name: 'duration',
        fullyQualifiedName: 'duration',
        description:
          '"Duration in ISO 8601 format in UTC. Example - \'P23DT23H\'."',
        displayName: 'duration',
        href: 'http://localhost:8585/api/v1/metadata/types/21dc01b3-5dd5-4534-a72c-a8badc519954',
      },
    },
    {
      name: 'emailCp',
      description: 'emailCp',
      propertyType: {
        id: '176103aa-f539-46cc-a173-fd7e03cc1c76',
        type: 'type',
        name: 'email',
        fullyQualifiedName: 'email',
        description: '"Email address of a user or other entities."',
        displayName: 'email',
        href: 'http://localhost:8585/api/v1/metadata/types/176103aa-f539-46cc-a173-fd7e03cc1c76',
      },
    },
    {
      name: 'expert',
      description: 'user',
      propertyType: {
        id: 'e05cc88f-a324-4a83-bb66-d332540095d1',
        type: 'type',
        name: 'entityReference',
        fullyQualifiedName: 'entityReference',
        description: '"Entity Reference for Custom Property."',
        displayName: 'entityReference',
        href: 'http://localhost:8585/api/v1/metadata/types/e05cc88f-a324-4a83-bb66-d332540095d1',
      },
      customPropertyConfig: {
        config: ['user'],
      },
    },
    {
      name: 'expertListPanel',
      description: 'expertListPanel',
      propertyType: {
        id: 'ae86b69c-6296-43ab-a532-9aa5ecf85c09',
        type: 'type',
        name: 'entityReferenceList',
        fullyQualifiedName: 'entityReferenceList',
        description: '"Entity Reference List for Custom Property."',
        displayName: 'entityReferenceList',
        href: 'http://localhost:8585/api/v1/metadata/types/ae86b69c-6296-43ab-a532-9aa5ecf85c09',
      },
      customPropertyConfig: {
        config: [
          'table',
          'pipeline',
          'team',
          'user',
          'searchIndex',
          'topic',
          'container',
          'glossaryTerm',
          'mlmodel',
          'tag',
          'dashboardDataModel',
          'dashboard',
          'database',
          'databaseSchema',
          'storedProcedure',
        ],
      },
    },
    {
      name: 'integerCp',
      description: 'integerCp',
      propertyType: {
        id: '34ec7caa-26d8-43ec-8189-60cd6c4bf80f',
        type: 'type',
        name: 'integer',
        fullyQualifiedName: 'integer',
        description: '"An integer type."',
        displayName: 'integer',
        href: 'http://localhost:8585/api/v1/metadata/types/34ec7caa-26d8-43ec-8189-60cd6c4bf80f',
      },
    },
    {
      name: 'markdownCp',
      description: 'markdownCp',
      propertyType: {
        id: '7306754e-f4bb-4a52-8bef-cc183977f65f',
        type: 'type',
        name: 'markdown',
        fullyQualifiedName: 'markdown',
        description: '"Text in Markdown format."',
        displayName: 'markdown',
        href: 'http://localhost:8585/api/v1/metadata/types/7306754e-f4bb-4a52-8bef-cc183977f65f',
      },
    },
    {
      name: 'multiEnumCp',
      description: 'multiEnumCp',
      propertyType: {
        id: '7fc6eb17-0179-428e-8d9f-3770d4648547',
        type: 'type',
        name: 'enum',
        fullyQualifiedName: 'enum',
        description: '"List of values in Enum."',
        displayName: 'enum',
        href: 'http://localhost:8585/api/v1/metadata/types/7fc6eb17-0179-428e-8d9f-3770d4648547',
      },
      customPropertyConfig: {
        config: {
          values: ['multiCp1', 'm;l\'t"i:p,leCp'],
          multiSelect: true,
        },
      },
    },
    {
      name: 'numberCp',
      description: 'numberCp',
      propertyType: {
        id: '9e4a15d5-726f-487a-9424-94e1ca9057be',
        type: 'type',
        name: 'number',
        fullyQualifiedName: 'number',
        description:
          '"A numeric type that includes integer or floating point numbers."',
        displayName: 'number',
        href: 'http://localhost:8585/api/v1/metadata/types/9e4a15d5-726f-487a-9424-94e1ca9057be',
      },
    },
    {
      name: 'singleEnumCp',
      description: 'singleEnumCp',
      propertyType: {
        id: '7fc6eb17-0179-428e-8d9f-3770d4648547',
        type: 'type',
        name: 'enum',
        fullyQualifiedName: 'enum',
        description: '"List of values in Enum."',
        displayName: 'enum',
        href: 'http://localhost:8585/api/v1/metadata/types/7fc6eb17-0179-428e-8d9f-3770d4648547',
      },
      customPropertyConfig: {
        config: {
          values: ['single1', 's;i"n,g:l\'e'],
          multiSelect: false,
        },
      },
    },
    {
      name: 'sqlQueryCp',
      description: 'sqlQueryCp',
      propertyType: {
        id: '9b105f9e-0d43-4282-8e51-6ec2dc23570c',
        type: 'type',
        name: 'sqlQuery',
        fullyQualifiedName: 'sqlQuery',
        description:
          '"SQL query statement. Example - \'select * from orders\'."',
        displayName: 'sqlQuery',
        href: 'http://localhost:8585/api/v1/metadata/types/9b105f9e-0d43-4282-8e51-6ec2dc23570c',
      },
    },
    {
      name: 'stringCp',
      description: 'stringCp',
      propertyType: {
        id: 'a173abc7-893b-4af9-a1b3-18ec62c6d44b',
        type: 'type',
        name: 'string',
        fullyQualifiedName: 'string',
        description: '"A String type."',
        displayName: 'string',
        href: 'http://localhost:8585/api/v1/metadata/types/a173abc7-893b-4af9-a1b3-18ec62c6d44b',
      },
    },
    {
      name: 'timeCp',
      description: 'timeCp',
      propertyType: {
        id: 'b83e462e-58f4-409f-acf8-11ee1a107240',
        type: 'type',
        name: 'time-cp',
        fullyQualifiedName: 'time-cp',
        description: '"Time as defined in custom property."',
        displayName: 'time-cp',
        href: 'http://localhost:8585/api/v1/metadata/types/b83e462e-58f4-409f-acf8-11ee1a107240',
      },
      customPropertyConfig: {
        config: 'HH:mm:ss',
      },
    },
    {
      name: 'timeStampCp',
      description: 'timeStampCp',
      propertyType: {
        id: '68cc48c3-8fc9-4ea8-a5e4-cfb679ff2b07',
        type: 'type',
        name: 'timestamp',
        fullyQualifiedName: 'timestamp',
        description: '"Timestamp in Unix epoch time milliseconds."',
        displayName: 'timestamp',
        href: 'http://localhost:8585/api/v1/metadata/types/68cc48c3-8fc9-4ea8-a5e4-cfb679ff2b07',
      },
    },
    {
      name: 'timerIntervalCp',
      description: 'timerIntervalCp',
      propertyType: {
        id: '5e070252-d6e3-47dd-9ff3-c4a5862fad22',
        type: 'type',
        name: 'timeInterval',
        fullyQualifiedName: 'timeInterval',
        description: '"Time interval in unixTimeMillis."',
        displayName: 'timeInterval',
        href: 'http://localhost:8585/api/v1/metadata/types/5e070252-d6e3-47dd-9ff3-c4a5862fad22',
      },
    },
  ],
  version: 1.7,
  updatedAt: 1727532551691,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/metadata/types/84b20f4c-6d7d-4294-a7d4-2f8adcbcdbf8',
  changeDescription: {
    fieldsAdded: [
      {
        name: 'customProperties',
        newValue:
          '[{"name":"timeStampCp","description":"timeStampCp","propertyType":{"id":"68cc48c3-8fc9-4ea8-a5e4-cfb679ff2b07","type":"type","name":"timestamp","fullyQualifiedName":"timestamp","description":"\\"Timestamp in Unix epoch time milliseconds.\\"","displayName":"timestamp"}}]',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 1.6,
  },
};

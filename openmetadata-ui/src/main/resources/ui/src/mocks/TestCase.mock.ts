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

import { TestCaseStatus } from '../generated/tests/testCase';

export const MOCK_TEST_CASE_DATA = {
  id: '4188c516-0d74-4692-bfe6-1727c58893f9',
  name: 'column_values_to_be_between',
  fullyQualifiedName:
    'sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between',
  description: 'test the number of column in table is between x and y',
  testDefinition: {
    id: '43eeca01-e128-4de7-9e92-8035f4823993',
    type: 'testDefinition',
    name: 'columnValuesToBeBetween',
    fullyQualifiedName: 'columnValuesToBeBetween',
    description:
      'This schema defines the test ColumnValuesToBeBetween. Test the values in a column to be between minimum and maximum value. ',
    displayName: 'Column Values To Be Between',
    deleted: false,
    href: 'http://localhost:8585/api/v1/dataQuality/testDefinitions/43eeca01-e128-4de7-9e92-8035f4823993',
  },
  entityLink:
    '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::zip>',
  entityFQN: 'sample_data.ecommerce_db.shopify.dim_address.zip',
  testSuite: {
    id: 'bce9b69f-125a-42a8-b06a-13bdbc049f8d',
    type: 'testSuite',
    name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.testSuite',
    description: 'This is an basic test suite linked to an entity',
    deleted: false,
    href: 'http://localhost:8585/api/v1/dataQuality/testSuites/bce9b69f-125a-42a8-b06a-13bdbc049f8d',
  },
  parameterValues: [
    {
      name: 'min',
      value: '90001',
    },
    {
      name: 'max',
      value: '96162',
    },
  ],
  testCaseResult: {
    timestamp: 1709608151823,
    testCaseStatus: TestCaseStatus.Aborted,
    result:
      'We expect `min` & `max` to be informed on the profiler for ColumnValuesToBeBetween but got min=None, max=None.',
    testResultValue: [
      {
        name: 'min',
        value: 'None',
      },
      {
        name: 'max',
        value: 'None',
      },
    ],
  },
  version: 0.1,
  updatedAt: 1709608150209,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/dataQuality/testCases/4188c516-0d74-4692-bfe6-1727c58893f9',
  deleted: false,
  computePassedFailedRowCount: false,
};

export const MOCK_THREAD_DATA = [
  {
    id: '33873393-bd68-46e9-bccc-7701c1c41ad6',
    type: 'Task',
    threadTs: 1703570590556,
    about:
      '<#E::testCase::sample_data.ecommerce_db.shopify.dim_address.table_column_count_between>',
    entityId: '6206a003-281c-4984-9728-4e949a4e4023',
    createdBy: 'admin',
    updatedAt: 1703570590652,
    updatedBy: 'admin',
    resolved: false,
    message: 'Test Case Failure Resolution requested for ',
    postsCount: 1,
    posts: [
      {
        id: 'a3e5f8cc-f852-47a4-b2a3-3dd4f5e52f89',
        message: 'Resolved the Task.',
        postTs: 1703570590652,
        from: 'admin',
        reactions: [],
      },
    ],
    task: {
      id: 6,
      type: 'RequestTestCaseFailureResolution',
      assignees: [
        {
          id: 'd75b492b-3b73-449d-922c-14b61bc44b3d',
          type: 'user',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          deleted: false,
        },
      ],
      status: 'Closed',
      closedBy: 'admin',
      closedAt: 1703570590648,
      newValue: 'Resolution comment',
      testCaseResolutionStatusId: 'f93d08e9-2d38-4d01-a294-f8b44fbb0f4a',
    },
  },
  {
    id: '9950d7a0-01a4-4e02-bd7f-c431d9cd77f1',
    type: 'Task',
    threadTs: 1703570590829,
    about:
      '<#E::testCase::sample_data.ecommerce_db.shopify.dim_address.table_column_count_between>',
    entityId: '6206a003-281c-4984-9728-4e949a4e4023',
    createdBy: 'admin',
    updatedAt: 1703570590829,
    updatedBy: 'admin',
    resolved: false,
    message: 'Test Case Failure Resolution requested for ',
    postsCount: 0,
    posts: [],
    task: {
      id: 9,
      type: 'RequestTestCaseFailureResolution',
      assignees: [
        {
          id: 'd75b492b-3b73-449d-922c-14b61bc44b3d',
          type: 'user',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          deleted: false,
        },
      ],
      status: 'Open',
      testCaseResolutionStatusId: '65f7a1d2-ee28-4b43-b504-4be90c689f4d',
    },
  },
];

export const MOCK_TEST_CASE_RESOLUTION_STATUS = [
  {
    id: 'a6029315-dcf9-4ed0-a26f-80077c97fe39',
    stateId: '65f7a1d2-ee28-4b43-b504-4be90c689f4d',
    timestamp: 1709608154987,
    testCaseResolutionStatusType: 'New',
    updatedBy: {
      id: '88e03a7b-3d53-4eaa-8daa-909cd535bedc',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      deleted: false,
    },
    updatedAt: 1709608154987,
    testCaseReference: {
      id: '4188c516-0d74-4692-bfe6-1727c58893f9',
      type: 'testCase',
      name: 'column_values_to_be_between',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between',
      description: 'test the number of column in table is between x and y',
      deleted: false,
      href: 'http://openmetadata-server:8585/api/v1/dataQuality/testCases/4188c516-0d74-4692-bfe6-1727c58893f9',
    },
  },
  {
    id: 'a7dca0d9-402e-46de-a814-b2891efbedea',
    stateId: '65f7a1d2-ee28-4b43-b504-4be90c689f4d',
    timestamp: 1709608155011,
    testCaseResolutionStatusType: 'Ack',
    updatedBy: {
      id: '88e03a7b-3d53-4eaa-8daa-909cd535bedc',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      deleted: false,
    },
    updatedAt: 1709608155011,
    testCaseReference: {
      id: '4188c516-0d74-4692-bfe6-1727c58893f9',
      type: 'testCase',
      name: 'column_values_to_be_between',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between',
      description: 'test the number of column in table is between x and y',
      deleted: false,
      href: 'http://openmetadata-server:8585/api/v1/dataQuality/testCases/4188c516-0d74-4692-bfe6-1727c58893f9',
    },
  },
];

export const MOCK_INITIAL_ASSIGNEE = [
  {
    id: '5ee13b3b-9aa1-48c8-abd2-b6f97fe46bd3',
    type: 'user',
    deleted: false,
    displayName: 'Aaron Johnson',
    fullyQualifiedName: 'aaron_johnson0',
    href: 'http://localhost:8585/api/v1/users/5ee13b3b-9aa1-48c8-abd2-b6f97fe46bd3',
    name: 'aaron_johnson0',
  },
  {
    id: '35df8718-b51d-4756-99e8-18fb3aecbda2',
    type: 'user',
    deleted: false,
    displayName: 'Aaron Singh',
    fullyQualifiedName: '"aaron.singh2"',
    href: 'http://localhost:8585/api/v1/users/35df8718-b51d-4756-99e8-18fb3aecbda2',
    name: 'aaron.singh2',
  },
  {
    id: '0746bb37-8235-4619-a675-ee86691bb200',
    type: 'user',
    deleted: false,
    displayName: 'Aaron Warren',
    fullyQualifiedName: '"aaron.warren5"',
    href: 'http://localhost:8585/api/v1/users/0746bb37-8235-4619-a675-ee86691bb200',
    name: 'aaron.warren5',
  },
  {
    id: 'd9d410a2-bca3-490f-89e6-47c2c0d01e24',
    type: 'user',
    deleted: false,
    displayName: 'Adam Rodriguez',
    fullyQualifiedName: 'adam_rodriguez9',
    href: 'http://localhost:8585/api/v1/users/d9d410a2-bca3-490f-89e6-47c2c0d01e24',
    name: 'adam_rodriguez9',
  },
  {
    id: '3a658300-e10a-4378-a8dc-373440c3dbd4',
    type: 'user',
    deleted: false,
    displayName: 'Adam Matthews',
    fullyQualifiedName: '"adam.matthews2"',
    href: 'http://localhost:8585/api/v1/users/3a658300-e10a-4378-a8dc-373440c3dbd4',
    name: 'adam.matthews2',
  },
  {
    id: '88e03a7b-3d53-4eaa-8daa-909cd535bedc',
    type: 'user',
    deleted: false,
    fullyQualifiedName: 'admin',
    href: 'http://localhost:8585/api/v1/users/88e03a7b-3d53-4eaa-8daa-909cd535bedc',
    name: 'admin',
  },
  {
    id: '4268e211-b40d-4702-8795-2efc34b159a0',
    type: 'user',
    deleted: false,
    displayName: 'Alec Kane',
    fullyQualifiedName: 'alec_kane4',
    href: 'http://localhost:8585/api/v1/users/4268e211-b40d-4702-8795-2efc34b159a0',
    name: 'alec_kane4',
  },
];

export const MOCK_TEST_CASE_INCIDENT = {
  data: [
    {
      id: 'a7dca0d9-402e-46de-a814-b2891efbedea',
      stateId: '65f7a1d2-ee28-4b43-b504-4be90c689f4d',
      timestamp: 1709608155011,
      testCaseResolutionStatusType: 'Ack',
      updatedBy: {
        id: '88e03a7b-3d53-4eaa-8daa-909cd535bedc',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
      },
      updatedAt: 1709608155011,
      testCaseReference: {
        id: '4188c516-0d74-4692-bfe6-1727c58893f9',
        type: 'testCase',
        name: 'column_values_to_be_between',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between',
        description: 'test the number of column in table is between x and y',
        deleted: false,
        href: 'http://openmetadata-server:8585/api/v1/dataQuality/testCases/4188c516-0d74-4692-bfe6-1727c58893f9',
      },
    },
    {
      id: 'a6029315-dcf9-4ed0-a26f-80077c97fe39',
      stateId: '65f7a1d2-ee28-4b43-b504-4be90c689f4d',
      timestamp: 1709608154987,
      testCaseResolutionStatusType: 'New',
      updatedBy: {
        id: '88e03a7b-3d53-4eaa-8daa-909cd535bedc',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
      },
      updatedAt: 1709608154987,
      testCaseReference: {
        id: '4188c516-0d74-4692-bfe6-1727c58893f9',
        type: 'testCase',
        name: 'column_values_to_be_between',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between',
        description: 'test the number of column in table is between x and y',
        deleted: false,
        href: 'http://openmetadata-server:8585/api/v1/dataQuality/testCases/4188c516-0d74-4692-bfe6-1727c58893f9',
      },
    },
  ],
  paging: {
    total: 2,
  },
};

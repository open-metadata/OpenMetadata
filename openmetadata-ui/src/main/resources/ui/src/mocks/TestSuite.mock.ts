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

import { Table } from 'generated/entity/data/table';
import { TestCase } from 'generated/tests/testCase';

export const MOCK_TABLE_DATA = {
  data: [
    {
      deleted: false,
      description: 'this is test test',
      fullyQualifiedName: 'test',
      href: 'http://localhost:8585/api/v1/testSuite/db3e145b-4e17-4e39-b44e-801ed0d5e6dc',
      id: 'db3e145b-4e17-4e39-b44e-801ed0d5e6dc',
      name: 'test',
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacca',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      tests: [],
      updatedAt: 1670667043105,
      updatedBy: 'admin',
      version: 0.1,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676',
      name: 'test1',
      fullyQualifiedName: 'test1',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacca',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      deleted: false,
      description: 'this is test test',
      fullyQualifiedName: 'test2',
      href: 'http://localhost:8585/api/v1/testSuite/db3e145b-4e17-4e39-b44e-801ed0d5e6dc',
      id: 'db3e145b-4e17-4e39-b44e-801ed0d5e6dd',
      name: 'test2',
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacca',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      tests: [],
      updatedAt: 1670667043105,
      updatedBy: 'admin',
      version: 0.1,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676',
      name: 'test3',
      fullyQualifiedName: 'test3',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      deleted: false,
      description: 'this is test test',
      fullyQualifiedName: 'test4',
      href: 'http://localhost:8585/api/v1/testSuite/db3e145b-4e17-4e39-b44e-801ed0d5e6dc',
      id: 'db3e145b-4e17-4e39-b44e-801ed0d5e6df',
      name: 'test4',
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacca',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      tests: [],
      updatedAt: 1670667043105,
      updatedBy: 'admin',
      version: 0.1,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676g',
      name: 'test5',
      fullyQualifiedName: 'test5',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacca',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      deleted: false,
      description: 'this is test test',
      fullyQualifiedName: 'test6',
      href: 'http://localhost:8585/api/v1/testSuite/db3e145b-4e17-4e39-b44e-801ed0d5e6dc',
      id: 'db3e145b-4e17-4e39-b44e-801ed0d5e6dh',
      name: 'test6',
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacca',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      tests: [],
      updatedAt: 1670667043105,
      updatedBy: 'admin',
      version: 0.1,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676i',
      name: 'test7',
      fullyQualifiedName: 'test7',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676j',
      name: 'test8',
      fullyQualifiedName: 'test8',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676k',
      name: 'test9',
      fullyQualifiedName: 'test9',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676l',
      name: 'test10',
      fullyQualifiedName: 'test10',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676m',
      name: 'test11',
      fullyQualifiedName: 'test11',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676n',
      name: 'test12',
      fullyQualifiedName: 'test12',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676o',
      name: 'test13',
      fullyQualifiedName: 'test13',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676p',
      name: 'test14',
      fullyQualifiedName: 'test14',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
    {
      id: '164159a3-d3d8-4847-a0b5-814849e52676q',
      name: 'test15',
      fullyQualifiedName: 'test15',
      description: 'this is test',
      tests: [],
      owner: {
        id: '54f92fc2-8a10-472b-8e22-bbdb801aacce',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
        href: 'http://localhost:8585/api/v1/users/54f92fc2-8a10-472b-8e22-bbdb801aacca',
      },
      version: 0.1,
      updatedAt: 1670667255078,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/testSuite/164159a3-d3d8-4847-a0b5-814849e52676',
      deleted: false,
    },
  ],
  paging: { total: 16 },
};

export const MOCK_TEST_CASE = [
  {
    id: '5f83c798-91ac-4289-aeb0-99ef372e7e96',
    name: 'column_values_to_match_regex',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.last_name.column_values_to_match_regex',
    description: 'test value of a column match regex',
    testDefinition: {
      id: '2e5decd0-1a7e-45a3-bee6-aa9252d5d4f4',
      type: 'testDefinition',
      name: 'columnValuesToMatchRegex',
      fullyQualifiedName: 'columnValuesToMatchRegex',
      description:
        'This schema defines the test ColumnValuesToMatchRegex. Test the values in a column to match a given regular expression. ',
      displayName: 'Column Values To Match Regex Pattern',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testDefinition/2e5decd0-1a7e-45a3-bee6-aa9252d5d4f4',
    },
    entityLink:
      '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::last_name>',
    entityFQN: 'sample_data.ecommerce_db.shopify.dim_address.last_name',
    testSuite: {
      id: '9842a678-5d48-4942-b25a-c07511fcedbb',
      type: 'testSuite',
      name: 'critical_metrics_suite',
      fullyQualifiedName: 'critical_metrics_suite',
      description:
        'This is a critical test suite running tests important for the business',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testSuite/9842a678-5d48-4942-b25a-c07511fcedbb',
    },
    parameterValues: [
      {
        name: 'regex',
        value: 'Doe.*',
      },
    ],
    testCaseResult: {
      timestamp: 1677046336,
      testCaseStatus: 'Success',
      result:
        'Found 99 value(s) matching regex pattern vs 99 value(s) in the column.',
      testResultValue: [
        {
          name: 'likeCount',
          value: '65',
        },
      ],
    },
    version: 0.1,
    updatedAt: 1676033824688,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/testCase/5f83c798-91ac-4289-aeb0-99ef372e7e96',
    deleted: false,
  },
  {
    id: '08c516ab-4b6b-496a-ae9b-334a22163537',
    name: 'column_value_max_to_be_between',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.shop_id.column_value_max_to_be_between',
    description: 'test the value of a column is between x and y',
    testDefinition: {
      id: '01fec9a7-55a2-476f-8957-b3bda6a02aaf',
      type: 'testDefinition',
      name: 'columnValueMaxToBeBetween',
      fullyQualifiedName: 'columnValueMaxToBeBetween',
      description:
        'This schema defines the test ColumnValueMaxToBeBetween. Test the maximum value in a col is within a range.',
      displayName: 'Column Value Max. to be Between',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testDefinition/01fec9a7-55a2-476f-8957-b3bda6a02aaf',
    },
    entityLink:
      '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::shop_id>',
    entityFQN: 'sample_data.ecommerce_db.shopify.dim_address.shop_id',
    testSuite: {
      id: '9842a678-5d48-4942-b25a-c07511fcedbb',
      type: 'testSuite',
      name: 'critical_metrics_suite',
      fullyQualifiedName: 'critical_metrics_suite',
      description:
        'This is a critical test suite running tests important for the business',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testSuite/9842a678-5d48-4942-b25a-c07511fcedbb',
    },
    parameterValues: [
      {
        name: 'minValueForMaxInCol',
        value: '50',
      },
      {
        name: 'maxValueForMaxInCol',
        value: '100',
      },
    ],
    testCaseResult: {
      timestamp: 1677046336,
      testCaseStatus: 'Success',
      result: 'Found max=65 vs. the expected min=50, max=100.',
      testResultValue: [
        {
          name: 'max',
          value: '65',
        },
      ],
    },
    version: 0.1,
    updatedAt: 1676033824652,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/testCase/08c516ab-4b6b-496a-ae9b-334a22163537',
    deleted: false,
  },
  {
    id: 'b3d92505-339d-437e-b687-842c4442385c',
    name: 'table_column_count_between',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.table_column_count_between',
    description: 'test the number of column in table is between x and y',
    testDefinition: {
      id: '95c5d470-2f5f-4c6b-89cb-4f52a77be26e',
      type: 'testDefinition',
      name: 'tableColumnCountToBeBetween',
      fullyQualifiedName: 'tableColumnCountToBeBetween',
      description:
        'This schema defines the test TableColumnCountToBeBetween. Test the number of columns to be between min max value.',
      displayName: 'Table Column Count To Be Between',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testDefinition/95c5d470-2f5f-4c6b-89cb-4f52a77be26e',
    },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
    entityFQN: 'sample_data.ecommerce_db.shopify.dim_address',
    testSuite: {
      id: '9842a678-5d48-4942-b25a-c07511fcedbb',
      type: 'testSuite',
      name: 'critical_metrics_suite',
      fullyQualifiedName: 'critical_metrics_suite',
      description:
        'This is a critical test suite running tests important for the business',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testSuite/9842a678-5d48-4942-b25a-c07511fcedbb',
    },
    parameterValues: [
      {
        name: 'minColValue',
        value: '1',
      },
      {
        name: 'maxColValue',
        value: '10',
      },
    ],
    testCaseResult: {
      timestamp: 1677046336,
      testCaseStatus: 'Success',
      result: 'Found 9 column vs. the expected range [1, 10].',
      testResultValue: [
        {
          name: 'columnCount',
          value: '9',
        },
      ],
    },
    version: 0.1,
    updatedAt: 1676033824610,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/testCase/b3d92505-339d-437e-b687-842c4442385c',
    deleted: false,
  },
  {
    id: 'd8736860-6c46-47f1-b13b-42ebd22ff651',
    name: 'table_column_count_equals',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals',
    description: 'test the number of column in table',
    testDefinition: {
      id: '6d96ba53-e630-4cde-85e7-effca05d859e',
      type: 'testDefinition',
      name: 'tableColumnCountToEqual',
      fullyQualifiedName: 'tableColumnCountToEqual',
      description:
        'This test defines the test TableColumnCountToEqual. Test the number of columns equal to a value.',
      displayName: 'Table Column Count To Equal',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testDefinition/6d96ba53-e630-4cde-85e7-effca05d859e',
    },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
    entityFQN: 'sample_data.ecommerce_db.shopify.dim_address',
    testSuite: {
      id: '9842a678-5d48-4942-b25a-c07511fcedbb',
      type: 'testSuite',
      name: 'critical_metrics_suite',
      fullyQualifiedName: 'critical_metrics_suite',
      description:
        'This is a critical test suite running tests important for the business',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testSuite/9842a678-5d48-4942-b25a-c07511fcedbb',
    },
    parameterValues: [
      {
        name: 'columnCount',
        value: '10',
      },
    ],
    testCaseResult: {
      timestamp: 1677046336,
      testCaseStatus: 'Success',
      result: 'Found 10 columns vs. the expected 10',
      testResultValue: [
        {
          name: 'columnCount',
          value: '10',
        },
      ],
    },
    version: 0.1,
    updatedAt: 1676033824530,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/testCase/d8736860-6c46-47f1-b13b-42ebd22ff651',
    deleted: false,
  },
  {
    id: '3b753aa2-41ec-473f-a391-f1367d8729a7',
    name: 'column_values_to_be_between',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between',
    description: 'test the number of column in table is between x and y',
    testDefinition: {
      id: 'a4a51fd7-7482-4479-877d-387c6371d1dd',
      type: 'testDefinition',
      name: 'columnValuesToBeBetween',
      fullyQualifiedName: 'columnValuesToBeBetween',
      description:
        'This schema defines the test ColumnValuesToBeBetween. Test the values in a column to be between minimum and maximum value. ',
      displayName: 'Column Values To Be Between',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testDefinition/a4a51fd7-7482-4479-877d-387c6371d1dd',
    },
    entityLink:
      '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::zip>',
    entityFQN: 'sample_data.ecommerce_db.shopify.dim_address.zip',
    testSuite: {
      id: '9842a678-5d48-4942-b25a-c07511fcedbb',
      type: 'testSuite',
      name: 'critical_metrics_suite',
      fullyQualifiedName: 'critical_metrics_suite',
      description:
        'This is a critical test suite running tests important for the business',
      deleted: false,
      href: 'http://localhost:8585/api/v1/testSuite/9842a678-5d48-4942-b25a-c07511fcedbb',
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
      timestamp: 1677046337,
      testCaseStatus: 'Aborted',
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
    updatedAt: 1676033824726,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/testCase/3b753aa2-41ec-473f-a391-f1367d8729a7',
    deleted: false,
  },
] as TestCase[];

export const MOCK_CHART_COLLECTION_DATA = {
  data: [
    {
      name: '21/Feb 11:42',
      timestamp: 1676959933,
      rowCount: 10256,
    },
    {
      name: '21/Feb 11:42',
      timestamp: 1676959935,
      rowCount: 13256,
    },
    {
      name: '21/Feb 11:42',
      timestamp: 1676959944,
      rowCount: 14567,
    },
    {
      name: '22/Feb 11:42',
      timestamp: 1677046333,
      rowCount: 13256,
    },
    {
      name: '22/Feb 11:42',
      timestamp: 1677046335,
      rowCount: 14567,
    },
    {
      name: '23/Feb 11:42',
      timestamp: 1677132733,
      rowCount: 14567,
    },
  ],
  information: [
    {
      title: 'Row Count',
      dataKey: 'rowCount',
      color: '#008376',
      latestValue: 14567,
    },
  ],
};

export const MOCK_TABLE_WITH_DATE_TIME_COLUMNS = {
  id: '975f9119-39bb-4901-b083-69b373cf8fe4',
  name: 'dim.product',
  columns: [
    {
      name: 'vendor',
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'description',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify."dim.product".vendor',
      tags: [],
      ordinalPosition: 4,
    },
    {
      name: 'created_at',
      dataType: 'TIMESTAMP',
      dataTypeDisplay: 'timestamp',
      description: 'description',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify."dim.product".created_at',
      tags: [],
      ordinalPosition: 5,
    },
    {
      name: 'deleted_at',
      dataType: 'TIMESTAMP',
      dataTypeDisplay: 'timestamp',
      description: 'description',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify."dim.product".deleted_at',
      tags: [],
      ordinalPosition: 6,
    },
  ],
} as Table;

export const MOCK_TABLE_ROW_INSERTED_COUNT_TO_BE_BETWEEN = {
  id: '756c7770-0af3-49a9-9905-75a2886e5eec',
  name: 'tableRowInsertedCountToBeBetween',
  displayName: 'Table Row Inserted Count To be Between',
  fullyQualifiedName: 'tableRowInsertedCountToBeBetween',
  description:
    'This schema defines the test tableRowInsertedCountToBeBetween. Test the number of rows inserted is between x and y.',
  entityType: 'TABLE',
  testPlatforms: ['OpenMetadata'],
  supportedDataTypes: [],
  parameterDefinition: [
    {
      name: 'columnName',
      displayName: 'Column Name',
      dataType: 'STRING',
      description:
        'Name of the Column. It should be a timestamp, date or datetime field.',
      required: true,
    },
    {
      name: 'rangeType',
      displayName: 'Range Type',
      dataType: 'STRING',
      description: "One of 'HOUR', 'DAY', 'MONTH', 'YEAR'",
      required: true,
    },
  ],
  version: 0.1,
  updatedAt: 1675211404184,
  updatedBy: 'admin',
  href: 'http://sandbox-beta.open-metadata.org/api/v1/testDefinition/756c7770-0af3-49a9-9905-75a2886e5eec',
  deleted: false,
};

export const MOCK_TABLE_COLUMN_NAME_TO_EXIST = {
  id: '6d4e4673-fd7f-4b37-811e-7645c3c17e93',
  name: 'tableColumnNameToExist',
  displayName: 'Table Column Name To Exist',
  fullyQualifiedName: 'tableColumnNameToExist',
  description:
    'This test defines the test TableColumnNameToExist. Test the table columns exists in the table.',
  entityType: 'TABLE',
  testPlatforms: ['OpenMetadata'],
  supportedDataTypes: [],
  parameterDefinition: [
    {
      name: 'columnName',
      displayName: 'Column Name',
      dataType: 'STRING',
      description: 'Expected column of the table to exist',
      required: true,
    },
  ],
  version: 0.1,
  updatedAt: 1672236872076,
  updatedBy: 'admin',
  href: 'http://sandbox-beta.open-metadata.org/api/v1/testDefinition/6d4e4673-fd7f-4b37-811e-7645c3c17e93',
  deleted: false,
};

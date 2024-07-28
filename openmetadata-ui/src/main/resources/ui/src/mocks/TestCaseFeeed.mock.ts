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
import { TestCaseFeedProps } from '../components/ActivityFeed/ActivityFeedCardV2/FeedCardBody/TestCaseFeed/TestCaseFeed.interface';
import { TestCaseStatus } from '../generated/tests/testCase';

export const MOCK_TEST_CASE_FEED_DATA: Readonly<TestCaseFeedProps> = {
  entitySpecificInfo: {
    testCaseResult: [
      {
        result:
          'We expect `min` & `max` to be informed on the profiler for ColumnValuesToBeBetween but got min=None, max=None.',
        timestamp: 1722042341800,
        testCaseStatus: TestCaseStatus.Aborted,
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
      {
        result:
          'Found min=35005, max=92808 vs. the expected min=90001, max=96162.',
        timestamp: 1721955941900,
        incidentId: 'b9f2b958-a7b2-40c0-8ed0-0b9c90203949',
        testCaseStatus: TestCaseStatus.Failed,
        testResultValue: [
          {
            name: 'min',
            value: '35005',
          },
          {
            name: 'max',
            value: '92808',
          },
        ],
      },
      {
        result:
          'Found min=90006, max=92808 vs. the expected min=90001, max=96162.',
        timestamp: 1721869541929,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [
          {
            name: 'min',
            value: '90006',
          },
          {
            name: 'max',
            value: '92808',
          },
        ],
      },
      {
        result:
          'Found min=35005, max=92808 vs. the expected min=90001, max=96162.',
        timestamp: 1721822192927,
        incidentId: 'f9f69b40-0e10-4de8-b8b0-a6a4a56085f2',
        testCaseStatus: TestCaseStatus.Failed,
        testResultValue: [
          {
            name: 'min',
            value: '35005',
          },
          {
            name: 'max',
            value: '92808',
          },
        ],
      },
    ],
    parameterValues: [],
    entityTestResultSummary: [
      {
        status: TestCaseStatus.Success,
        timestamp: 1722042340161,
        testCaseName:
          'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals',
      },
      {
        status: TestCaseStatus.Success,
        timestamp: 1722042340538,
        testCaseName:
          'sample_data.ecommerce_db.shopify.dim_address.table_column_count_between',
      },

      {
        status: TestCaseStatus.Aborted,
        timestamp: 1722042341800,
        testCaseName:
          'sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between',
      },
      {
        status: TestCaseStatus.Failed,
        timestamp: 1722042342218,
        testCaseName:
          'sample_data.ecommerce_db.shopify.dim_address.zip.column_values_to_be_between_with_sample_rows',
      },
    ],
  },
  testCaseName: 'column_values_to_be_between',
};

export const MOCK_TEST_CASE_FEED_DATA_2: Readonly<TestCaseFeedProps> = {
  entitySpecificInfo: {
    testCaseResult: [
      {
        result:
          'Found min=90006, max=92808 vs. the expected min=90001, max=96162.',
        timestamp: 1721869541929,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [
          {
            name: 'min',
            value: '90006',
          },
          {
            name: 'max',
            value: '92808',
          },
        ],
      },
      {
        result:
          'Found min=90006, max=92808 vs. the expected min=90001, max=96162.',
        timestamp: 1721783208215,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [
          {
            name: 'min',
            value: '90006',
          },
          {
            name: 'max',
            value: '92808',
          },
        ],
      },
      {
        result:
          'Found min=90002, max=95640 vs. the expected min=90001, max=96162.',
        timestamp: 1721783141954,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [
          {
            name: 'min',
            value: '90002',
          },
          {
            name: 'max',
            value: '95640',
          },
        ],
      },
      {
        result:
          'Found min=90006, max=92808 vs. the expected min=90001, max=96162.',
        timestamp: 1721735793017,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [
          {
            name: 'min',
            value: '90006',
          },
          {
            name: 'max',
            value: '92808',
          },
        ],
      },
      {
        result:
          'Found min=90002, max=95640 vs. the expected min=90001, max=96162.',
        timestamp: 1721696808240,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [
          {
            name: 'min',
            value: '90002',
          },
          {
            name: 'max',
            value: '95640',
          },
        ],
      },
      {
        result:
          'Found min=90002, max=95640 vs. the expected min=90001, max=96162.',
        timestamp: 1721649393044,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [
          {
            name: 'min',
            value: '90002',
          },
          {
            name: 'max',
            value: '95640',
          },
        ],
      },
      {
        result:
          'Found min=91009, max=92808 vs. the expected min=90001, max=96162.',
        timestamp: 1721523942040,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [
          {
            name: 'min',
            value: '91009',
          },
          {
            name: 'max',
            value: '92808',
          },
        ],
      },
    ],
    parameterValues: [],
    entityTestResultSummary: [
      {
        status: TestCaseStatus.Success,
        timestamp: 1722042340161,
        testCaseName:
          'sample_data.ecommerce_db.shopify.dim_address.table_column_count_equals',
      },
      {
        status: TestCaseStatus.Success,
        timestamp: 1722042340538,
        testCaseName:
          'sample_data.ecommerce_db.shopify.dim_address.table_column_count_between',
      },
      {
        status: TestCaseStatus.Success,
        timestamp: 1722042340857,
        testCaseName:
          'sample_data.ecommerce_db.shopify.dim_address.shop_id.column_value_max_to_be_between',
      },
      {
        status: TestCaseStatus.Success,
        timestamp: 1722042341254,
        testCaseName:
          'sample_data.ecommerce_db.shopify.dim_address.last_name.column_values_to_match_regex',
      },
    ],
  },
  testCaseName: 'column_values_to_be_between',
};

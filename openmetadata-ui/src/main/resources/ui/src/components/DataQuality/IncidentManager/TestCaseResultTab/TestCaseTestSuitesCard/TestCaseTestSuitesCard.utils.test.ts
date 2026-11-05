/*
 *  Copyright 2026 Collate.
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
import { TestSuite } from '../../../../../generated/tests/testSuite';
import { getTestSuiteLink } from './TestCaseTestSuitesCard.utils';

describe('getTestSuiteLink', () => {
  it('sends a table suite to its table, since the table is where its tests live', () => {
    const tableSuite = {
      name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.dim_address.testSuite',
      basic: true,
      basicEntityReference: {
        id: 'table-id',
        type: 'table',
        name: 'dim_address',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
      },
    } as TestSuite;

    expect(getTestSuiteLink(tableSuite)).toEqual({
      name: 'dim_address',
      path: '/table/sample_data.ecommerce_db.shopify.dim_address/profiler/data-quality',
    });
  });

  it('sends a bundle suite to its own details page', () => {
    const bundleSuite = {
      name: 'critical_orders',
      displayName: 'Critical Orders',
      fullyQualifiedName: 'critical_orders',
      basic: false,
    } as TestSuite;

    expect(getTestSuiteLink(bundleSuite)).toEqual({
      name: 'Critical Orders',
      path: '/test-suites/critical_orders',
    });
  });
});

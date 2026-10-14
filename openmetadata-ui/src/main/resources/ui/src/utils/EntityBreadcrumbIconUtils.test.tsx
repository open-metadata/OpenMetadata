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
import { EntityType } from '../enums/entity.enum';
import { SearchSourceAlias } from '../interface/search.interface';
import { getEntityBreadcrumbItems } from './EntityBreadcrumbIconUtils';

describe('getEntityBreadcrumbItems', () => {
  it('links a tag search result to its parent classification page', () => {
    const items = getEntityBreadcrumbItems({
      entityType: EntityType.TAG,
      name: 'Personal',
      fullyQualifiedName: 'PersonalData.Personal',
      classification: {
        name: 'PersonalData',
        fullyQualifiedName: 'PersonalData',
      },
    } as unknown as SearchSourceAlias);

    expect(items.map(({ label, href }) => [label, href])).toEqual([
      ['PersonalData', '/tags/PersonalData'],
      ['Personal', '/tag/PersonalData.Personal'],
    ]);
  });

  it('links a table search result to its service, database and schema', () => {
    const items = getEntityBreadcrumbItems({
      entityType: EntityType.TABLE,
      name: 'orders',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.orders',
      serviceType: 'BigQuery',
      service: {
        name: 'sample_data',
        fullyQualifiedName: 'sample_data',
        type: 'databaseService',
      },
      database: {
        name: 'ecommerce_db',
        fullyQualifiedName: 'sample_data.ecommerce_db',
        type: 'database',
      },
      databaseSchema: {
        name: 'shopify',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
        type: 'databaseSchema',
      },
    } as unknown as SearchSourceAlias);

    expect(items.map(({ label, href }) => [label, href])).toEqual([
      ['sample_data', '/service/databaseServices/sample_data'],
      ['ecommerce_db', '/database/sample_data.ecommerce_db'],
      ['shopify', '/databaseSchema/sample_data.ecommerce_db.shopify'],
    ]);
  });
});

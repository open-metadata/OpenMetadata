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

import { SearchIndex } from '../../enums/search.enum';
import {
  ConstraintType,
  DatabaseServiceType,
  DataType,
  LabelType,
  State,
  TableType,
  TagSource,
} from '../../generated/entity/data/table';
import { SearchResponse } from '../../interface/search.interface';
import { ExploreSearchIndex } from './explore.interface';

export const mockResponse: SearchResponse<ExploreSearchIndex> = {
  hits: {
    total: {
      value: 15,
      relation: 'eq',
    },
    hits: [
      {
        _index: SearchIndex.TABLE,
        _type: '_doc',
        _id: '343fe234-299e-42be-8f67-3359a87892fb',
        _source: {
          entityType: 'table',
          type: 'table',
          id: '343fe234-299e-42be-8f67-3359a87892fb',
          name: 'dim_address',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
          displayName: 'dim_address',
          updatedAt: 1659023655062,
          updatedBy: 'anonymous',
          href: 'http://localhost:8585/api/v1/tables/343fe234-299e-42be-8f67-3359a87892fb',
          columns: [
            {
              dataType: DataType.Numeric,
              name: 'address_id',
              description: 'Unique identifier for the address.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.address_id',
              ordinalPosition: 1,
              dataTypeDisplay: 'numeric',
              tags: [],
            },
            {
              dataType: DataType.Numeric,
              name: 'shop_id',
              description:
                'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.shop_id',
              ordinalPosition: 2,
              dataTypeDisplay: 'numeric',
              tags: [],
            },
            {
              dataLength: 100,
              dataType: DataType.String,
              name: 'first_name',
              description: 'First name of the customer.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.first_name',
              ordinalPosition: 3,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
            {
              dataLength: 100,
              dataType: DataType.String,
              name: 'last_name',
              description: 'Last name of the customer.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.last_name',
              ordinalPosition: 4,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
            {
              dataLength: 500,
              dataType: DataType.String,
              name: 'address1',
              description: 'The first address line. For example, 150 Elgin St.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.address1',
              ordinalPosition: 5,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
            {
              dataLength: 500,
              dataType: DataType.String,
              name: 'address2',
              description: 'The second address line. For example, Suite 800.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.address2',
              ordinalPosition: 6,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
            {
              dataLength: 100,
              dataType: DataType.String,
              name: 'company',
              description:
                "The name of the customer's business, if one exists.",
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.company',
              ordinalPosition: 7,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
            {
              dataLength: 100,
              dataType: DataType.String,
              name: 'city',
              description: 'The name of the city. For example, Palo Alto.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.city',
              ordinalPosition: 8,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
            {
              dataLength: 512,
              dataType: DataType.String,
              name: 'region',
              description:
                'The name of the region, such as a province or state, ',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.region',
              ordinalPosition: 9,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
            {
              dataLength: 10,
              dataType: DataType.String,
              name: 'zip',
              description: 'The ZIP or postal code. For example, 90210.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.zip',
              ordinalPosition: 10,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
            {
              dataLength: 50,
              dataType: DataType.String,
              name: 'country',
              description: 'The full name of the country. For example, Canada.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.country',
              ordinalPosition: 11,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
            {
              dataLength: 15,
              dataType: DataType.String,
              name: 'phone',
              description: 'The phone number of the customer.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address.phone',
              ordinalPosition: 12,
              dataTypeDisplay: 'varchar',
              tags: [],
            },
          ],
          databaseSchema: {
            deleted: false,
            name: 'shopify',
            description:
              'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
            id: 'cedec7e5-93b3-4b2b-9647-05c198abbf19',
            href: 'http://localhost:8585/api/v1/databaseSchemas/cedec7e5-93b3-4b2b-9647-05c198abbf19',
            type: 'databaseSchema',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
          },
          database: {
            deleted: false,
            name: 'ecommerce_db',
            description:
              'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
            id: 'a32582b3-16ab-45e1-8e91-b75ac613ddc0',
            href: 'http://localhost:8585/api/v1/databases/a32582b3-16ab-45e1-8e91-b75ac613ddc0',
            type: 'database',
            fullyQualifiedName: 'sample_data.ecommerce_db',
          },
          service: {
            deleted: false,
            name: 'sample_data',
            id: '5375e6bb-87d9-4e4d-afbe-0b7f77e14427',
            href: 'http://localhost:8585/api/v1/services/databaseServices/5375e6bb-87d9-4e4d-afbe-0b7f77e14427',
            type: 'databaseService',
            fullyQualifiedName: 'sample_data',
          },
          usageSummary: {
            dailyStats: {
              count: 1,
              percentileRank: 0,
            },
            weeklyStats: {
              count: 1,
              percentileRank: 0,
            },
            monthlyStats: {
              count: 1,
              percentileRank: 0,
            },
            date: new Date('2022-07-25'),
          },
          deleted: false,
          serviceType: DatabaseServiceType.BigQuery,
          tags: [
            {
              tagFQN: 'PII.Sensitive',
              labelType: LabelType.Manual,
              description:
                'PII which if lost, compromised, or disclosed without authorization, could result in substantial harm, embarrassment, inconvenience, or unfairness to an individual.',
              source: TagSource.Classification,
              state: State.Confirmed,
            },
          ],
          followers: [],
          description:
            'This dimension table contains the billing and shipping addresses of customers.',
          tableType: TableType.Regular,
          tableConstraints: [
            {
              constraintType: ConstraintType.ForeignKey,
              columns: ['address_id', 'shop_id'],
            },
          ],
        },
      },
    ],
  },
  aggregations: {
    'sterms#Tier': {
      buckets: [],
    },
    'sterms#Service': {
      buckets: [
        {
          key: 'BigQuery',
          doc_count: 15,
        },
      ],
    },
    'sterms#Tags': {
      buckets: [],
    },
  },
};

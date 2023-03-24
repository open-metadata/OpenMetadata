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

import { findByText, render } from '@testing-library/react';
import { ExploreSearchIndex } from 'components/Explore/explore.interface';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { SearchIndex } from '../../enums/search.enum';
import {
  ConstraintType,
  DatabaseServiceType,
  DataType,
  TableType,
} from '../../generated/entity/data/table';
import { LabelType, State, TagSource } from '../../generated/type/tagLabel';
import {
  SearchRequest,
  SearchResponse,
} from '../../interface/search.interface';
import ExplorePage from './ExplorePage.component';

const aggregations = {
  entityType: {
    buckets: [
      {
        key: 'user',
        doc_count: 200,
      },
      {
        key: 'team',
        doc_count: 15,
      },
    ],
  },
  serviceCategory: {
    buckets: [],
  },
  'tier.tagFQN': {
    buckets: [],
  },
  'service.name.keyword': {
    buckets: [],
  },
  'service.type': {
    buckets: [],
  },
  'tags.tagFQN': {
    buckets: [],
  },
};

const mockData: SearchResponse<ExploreSearchIndex> = {
  took: 44,
  timed_out: false,
  hits: {
    total: {
      value: 4,
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
          version: 0.3,
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
              constraintType: ConstraintType.PrimaryKey,
              columns: ['address_id', 'shop_id'],
            },
          ],
        },
        highlight: {
          name: ['<span class="text-highlighter">dim_address</span>'],
          description: ['<span>testDescription</span>'],
        },
        sort: [1659023655062000],
      },
      {
        _index: SearchIndex.TABLE,
        _type: '_doc',
        _id: '81bf535d-ce3f-41d6-ba80-51f431ed94f4',
        _source: {
          entityType: 'table',
          type: 'table',
          id: '81bf535d-ce3f-41d6-ba80-51f431ed94f4',
          name: 'dim_address_clean',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean',
          displayName: 'dim_address_clean',
          version: 0.2,
          updatedAt: 1658941044740,
          updatedBy: 'anonymous',
          href: 'http://localhost:8585/api/v1/tables/81bf535d-ce3f-41d6-ba80-51f431ed94f4',
          columns: [
            {
              dataType: DataType.Numeric,
              name: 'address_id',
              description: 'Unique identifier for the address.',
              fullyQualifiedName:
                'sample_data.ecommerce_db.shopify.dim_address_clean.address_id',
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
                'sample_data.ecommerce_db.shopify.dim_address_clean.shop_id',
              ordinalPosition: 2,
              dataTypeDisplay: 'numeric',
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
          tags: [],
          followers: [],
          description: 'Created from dim_address after a small cleanup!',
          tableType: TableType.Regular,
          tableConstraints: [
            {
              constraintType: ConstraintType.PrimaryKey,
              columns: ['address_id', 'shop_id'],
            },
          ],
        },
        highlight: {
          name: ['<span class="text-highlighter">dim_address_clean</span>'],
          description: [
            'Created from <span class="text-highlighter">dim_address</span> after a small cleanup!',
          ],
        },
        sort: [1658941044740000],
      },
    ],
  },
  aggregations,
};

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ searchQuery: '' })),
  useHistory: () => ({
    push: jest.fn(),
    location: {
      pathname: '',
    },
  }),
  useLocation: jest
    .fn()
    .mockImplementation(() => ({ search: '', pathname: '/explore' })),
}));

jest.mock('../../AppState', () => ({
  updateExplorePageTab: jest.fn().mockReturnValue(''),
}));

jest.mock('components/Explore/Explore.component', () => {
  return jest.fn().mockReturnValue(<p>Explore Component</p>);
});

jest.mock('rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockImplementation(
      (
        req: SearchRequest<SearchIndex>
      ): Promise<SearchResponse<SearchIndex>> => {
        const { pageSize } = req;

        if (pageSize === 0) {
          return Promise.resolve({
            hits: { total: { value: 10 }, hits: [] },
            aggregations,
          });
        }

        return Promise.resolve(mockData);
      }
    ),
}));

describe('Test Explore page', () => {
  it('Page Should render', async () => {
    const { container } = render(<ExplorePage />, { wrapper: MemoryRouter });

    const explorePage = await findByText(container, /Explore Component/i);

    expect(explorePage).toBeInTheDocument();
  });
});

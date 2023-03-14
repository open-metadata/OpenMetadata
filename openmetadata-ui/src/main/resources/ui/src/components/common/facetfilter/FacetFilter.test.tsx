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

import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { Aggregations } from '../../../interface/search.interface';
import FacetFilter from './FacetFilter';

const onSelectHandler = jest.fn();
const onClearFilter = jest.fn();
const onChangeShowDelete = jest.fn();

const aggregations: Aggregations = {
  ['entityType']: {
    buckets: [
      {
        key: 'table',
        doc_count: 18,
      },
    ],
  },
  ['service.type']: {
    buckets: [
      {
        key: 'databaseService',
        doc_count: 18,
      },
    ],
  },
  'tier.tagFQN': {
    buckets: [],
  },
  'service.name.keyword': {
    buckets: [
      {
        key: 'sample_data',
        doc_count: 16,
      },
      {
        key: 'Glue',
        doc_count: 2,
      },
    ],
  },
  'database.name.keyword': {
    buckets: [
      {
        key: 'ecommerce_db',
        doc_count: 16,
      },
      {
        key: 'default',
        doc_count: 2,
      },
    ],
  },
  serviceType: {
    buckets: [
      {
        key: 'BigQuery',
        doc_count: 16,
      },
      {
        key: 'Glue',
        doc_count: 2,
      },
    ],
  },
  'tags.tagFQN': {
    buckets: [
      {
        key: 'PII.Sensitive',
        doc_count: 1,
      },
    ],
  },
  'databaseSchema.name.keyword': {
    buckets: [
      {
        key: 'shopify',
        doc_count: 16,
      },
      {
        key: 'information_schema',
        doc_count: 2,
      },
    ],
  },
};

jest.mock('utils/EntityUtils', () => ({
  getSortedTierBucketList: jest.fn().mockReturnValue([]),
}));

const filters = {
  serviceType: ['BigQuery', 'Glue'],
  'service.name.keyword': ['bigquery_gcp', 'glue'],
  'tier.tagFQN': ['Tier1', 'Tier2'],
  'tags.tagFQN': ['PII.Sensitive', 'User.Address'],
  'database.name.keyword': ['ecommerce_db', 'default'],
  'databaseSchema.name.keyword': ['shopify', 'information_schema'],
};

describe('Test FacetFilter Component', () => {
  it('Should render page with empty aggregations buckets', () => {
    const { container } = render(
      <FacetFilter
        aggregations={{}}
        filters={{}}
        onChangeShowDeleted={onChangeShowDelete}
        onClearFilter={onClearFilter}
        onSelectHandler={onSelectHandler}
      />
    );

    const filterPanel = getByTestId(container, 'face-filter');

    expect(filterPanel).toBeInTheDocument();
  });

  it('Should render all aggregations with non-empty buckets when no filters', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={{}}
        onChangeShowDeleted={onChangeShowDelete}
        onClearFilter={onClearFilter}
        onSelectHandler={onSelectHandler}
      />
    );

    const filterHeadings = getAllByTestId(container, (content) =>
      content.startsWith('filter-heading-')
    );

    expect(filterHeadings).toHaveLength(7);
    expect(
      filterHeadings.map((fh) => fh.getAttribute('data-testid')).sort()
    ).toStrictEqual(
      [
        'entityType',
        'service.type',
        'service.name.keyword',
        'database.name.keyword',
        'serviceType',
        'tags.tagFQN',
        'databaseSchema.name.keyword',
      ]
        .map((s) => `filter-heading-${s}`)
        .sort()
    );
  });

  it('Should render all aggregations with non-empty buckets or with filters', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onChangeShowDeleted={onChangeShowDelete}
        onClearFilter={onClearFilter}
        onSelectHandler={onSelectHandler}
      />
    );

    const filterHeadings = getAllByTestId(container, (content) =>
      content.startsWith('filter-heading-')
    );

    expect(filterHeadings).toHaveLength(8);
    expect(
      filterHeadings.map((fh) => fh.getAttribute('data-testid')).sort()
    ).toStrictEqual(
      [
        'tier.tagFQN',
        'entityType',
        'service.type',
        'service.name.keyword',
        'database.name.keyword',
        'serviceType',
        'tags.tagFQN',
        'databaseSchema.name.keyword',
      ]
        .map((s) => `filter-heading-${s}`)
        .sort()
    );
  });
});

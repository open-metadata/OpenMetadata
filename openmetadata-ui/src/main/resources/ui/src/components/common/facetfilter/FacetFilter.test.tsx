/*
 *  Copyright 2021 Collate
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

/* eslint-disable @typescript-eslint/camelcase */

import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { facetFilterPlaceholder } from '../../../constants/constants';
import FacetFilter from './FacetFilter';

const onSelectHandler = jest.fn();
const onClearFilter = jest.fn();
const onSelectAllFilter = jest.fn();
const aggregations = [
  {
    title: 'Service',
    buckets: [
      {
        key: 'BigQuery',
        doc_count: 15,
      },
      {
        key: 'Glue',
        doc_count: 2,
      },
    ],
  },
  {
    title: 'ServiceName',
    buckets: [
      {
        key: 'bigquery_gcp',
        doc_count: 15,
      },
      {
        key: 'glue',
        doc_count: 2,
      },
    ],
  },
  {
    title: 'Tier',
    buckets: [
      {
        key: 'Tier.Tier1',
        doc_count: 0,
      },
      {
        key: 'Tier.Tier2',
        doc_count: 0,
      },
      {
        key: 'Tier.Tier3',
        doc_count: 0,
      },
      {
        key: 'Tier.Tier4',
        doc_count: 0,
      },
      {
        key: 'Tier.Tier5',
        doc_count: 0,
      },
    ],
  },
  {
    title: 'Tags',
    buckets: [
      {
        key: 'PII.Sensitive',
        doc_count: 1,
      },
      {
        key: 'PersonalData.Personal',
        doc_count: 1,
      },
      {
        key: 'User.Address',
        doc_count: 1,
      },
    ],
  },
  {
    title: 'Database',
    buckets: [
      {
        key: 'ecommerce_db',
        doc_count: 15,
      },
      {
        key: 'default',
        doc_count: 2,
      },
    ],
  },
  {
    title: 'DatabaseSchema',
    buckets: [
      {
        key: 'shopify',
        doc_count: 15,
      },
      {
        key: 'information_schema',
        doc_count: 2,
      },
    ],
  },
];

const filters = {
  service: ['BigQuery', 'Glue'],
  servicename: ['bigquery_gcp', 'glue'],
  tier: ['Tier1', 'Tier2'],
  tags: ['PII.Sensitive', 'User.Address'],
  database: ['ecommerce_db', 'default'],
  databaseschema: ['shopify', 'information_schema'],
};

describe('Test FacetFilter Component', () => {
  it('Should render all filters', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onClearFilter={onClearFilter}
        onSelectAllFilter={onSelectAllFilter}
        onSelectHandler={onSelectHandler}
      />
    );
    const filterHeading = getAllByTestId(container, 'filter-heading');

    expect(filterHeading.length).toBe(6);
  });

  it('Should render matching placeholder heading for filters', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onClearFilter={onClearFilter}
        onSelectAllFilter={onSelectAllFilter}
        onSelectHandler={onSelectHandler}
      />
    );
    const filterHeading = getAllByTestId(container, 'filter-heading');

    for (let index = 0; index < aggregations.length; index++) {
      const element = aggregations[index];
      const placeholder = facetFilterPlaceholder.find(
        (p) => p.name === element.title
      );

      expect(filterHeading[index]).toHaveTextContent(placeholder?.value || '');
    }
  });

  it('Should render all filters for service', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onClearFilter={onClearFilter}
        onSelectAllFilter={onSelectAllFilter}
        onSelectHandler={onSelectHandler}
      />
    );
    const serviceAgg = getByTestId(container, aggregations[0].title);

    for (let index = 0; index < aggregations[0].buckets.length; index++) {
      const element = aggregations[0].buckets[index];

      expect(
        getByTestId(serviceAgg, `filter-container-${element.key}`)
      ).toBeInTheDocument();
    }
  });

  it('Should render all filters for service name', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onClearFilter={onClearFilter}
        onSelectAllFilter={onSelectAllFilter}
        onSelectHandler={onSelectHandler}
      />
    );
    const serviceNameAgg = getByTestId(container, aggregations[1].title);

    for (let index = 0; index < aggregations[1].buckets.length; index++) {
      const element = aggregations[1].buckets[index];

      expect(
        getByTestId(serviceNameAgg, `filter-container-${element.key}`)
      ).toBeInTheDocument();
    }
  });

  it('Should render all filters for tier', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onClearFilter={onClearFilter}
        onSelectAllFilter={onSelectAllFilter}
        onSelectHandler={onSelectHandler}
      />
    );
    const serviceNameAgg = getByTestId(container, aggregations[2].title);

    for (let index = 0; index < aggregations[2].buckets.length; index++) {
      const element = aggregations[2].buckets[index];

      expect(
        getByTestId(serviceNameAgg, `filter-container-${element.key}`)
      ).toBeInTheDocument();
    }
  });

  it('Should render all filters for tags', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onClearFilter={onClearFilter}
        onSelectAllFilter={onSelectAllFilter}
        onSelectHandler={onSelectHandler}
      />
    );
    const serviceNameAgg = getByTestId(container, aggregations[3].title);

    for (let index = 0; index < aggregations[3].buckets.length; index++) {
      const element = aggregations[3].buckets[index];

      expect(
        getByTestId(serviceNameAgg, `filter-container-${element.key}`)
      ).toBeInTheDocument();
    }
  });

  it('Should render all filters for database', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onClearFilter={onClearFilter}
        onSelectAllFilter={onSelectAllFilter}
        onSelectHandler={onSelectHandler}
      />
    );
    const serviceNameAgg = getByTestId(container, aggregations[4].title);

    for (let index = 0; index < aggregations[4].buckets.length; index++) {
      const element = aggregations[4].buckets[index];

      expect(
        getByTestId(serviceNameAgg, `filter-container-${element.key}`)
      ).toBeInTheDocument();
    }
  });

  it('Should render all filters for database schema', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onClearFilter={onClearFilter}
        onSelectAllFilter={onSelectAllFilter}
        onSelectHandler={onSelectHandler}
      />
    );
    const serviceNameAgg = getByTestId(container, aggregations[5].title);

    for (let index = 0; index < aggregations[5].buckets.length; index++) {
      const element = aggregations[5].buckets[index];

      expect(
        getByTestId(serviceNameAgg, `filter-container-${element.key}`)
      ).toBeInTheDocument();
    }
  });
});

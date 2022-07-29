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

import { getAllByTestId, render } from '@testing-library/react';
import React from 'react';
import FacetFilter from './FacetFilter';
import { Aggregations } from '../../../interface/search.interface';

const onSelectHandler = jest.fn();
const onClearFilter = jest.fn();
const onSelectAllFilter = jest.fn();
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
  tier: {
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

const filters = {
  serviceType: ['BigQuery', 'Glue'],
  'service.name.keyword': ['bigquery_gcp', 'glue'],
  tier: ['Tier1', 'Tier2'],
  'tags.tagFQN': ['PII.Sensitive', 'User.Address'],
  'database.name.keyword': ['ecommerce_db', 'default'],
  'databaseSchema.name.keyword': ['shopify', 'information_schema'],
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

    expect(filterHeading.length).toBe(7);
  });
  //
  // it('Should render matching placeholder heading for filters', () => {
  //   const { container } = render(
  //     <FacetFilter
  //       aggregations={aggregations}
  //       filters={filters}
  //       onClearFilter={onClearFilter}
  //       onSelectAllFilter={onSelectAllFilter}
  //       onSelectHandler={onSelectHandler}
  //     />
  //   );
  //   const filterHeading = getAllByTestId(container, 'filter-heading');
  //
  //   for (const [index, element] of Object.entries(aggregations)) {
  //     const placeholder = facetFilterPlaceholder.find(
  //       (p) => p.name === element
  //     );
  //
  //     expect(filterHeading[index]).toHaveTextContent(placeholder?.value || '');
  //   }
  // });

  // it('Should render all filters for service', () => {
  //   const { container } = render(
  //     <FacetFilter
  //       aggregations={aggregations}
  //       filters={filters}
  //       onClearFilter={onClearFilter}
  //       onSelectAllFilter={onSelectAllFilter}
  //       onSelectHandler={onSelectHandler}
  //     />
  //   );
  //   const serviceAgg = getByTestId(container, aggregations[0].title);
  //
  //   for (let index = 0; index < aggregations[0].buckets.length; index++) {
  //     const element = aggregations[0].buckets[index];
  //
  //     expect(
  //       getByTestId(serviceAgg, `filter-container-${element.key}`)
  //     ).toBeInTheDocument();
  //   }
  // });
  //
  // it('Should render all filters for service name', () => {
  //   const { container } = render(
  //     <FacetFilter
  //       aggregations={aggregations}
  //       filters={filters}
  //       onClearFilter={onClearFilter}
  //       onSelectAllFilter={onSelectAllFilter}
  //       onSelectHandler={onSelectHandler}
  //     />
  //   );
  //   const serviceNameAgg = getByTestId(container, aggregations[1].title);
  //
  //   for (let index = 0; index < aggregations[1].buckets.length; index++) {
  //     const element = aggregations[1].buckets[index];
  //
  //     expect(
  //       getByTestId(serviceNameAgg, `filter-container-${element.key}`)
  //     ).toBeInTheDocument();
  //   }
  // });
  //
  // it('Should render all filters for tier', () => {
  //   const { container } = render(
  //     <FacetFilter
  //       aggregations={aggregations}
  //       filters={filters}
  //       onClearFilter={onClearFilter}
  //       onSelectAllFilter={onSelectAllFilter}
  //       onSelectHandler={onSelectHandler}
  //     />
  //   );
  //   const serviceNameAgg = getByTestId(container, aggregations[2].title);
  //
  //   for (let index = 0; index < aggregations[2].buckets.length; index++) {
  //     const element = aggregations[2].buckets[index];
  //
  //     expect(
  //       getByTestId(serviceNameAgg, `filter-container-${element.key}`)
  //     ).toBeInTheDocument();
  //   }
  // });
  //
  // it('Should render all filters for tags', () => {
  //   const { container } = render(
  //     <FacetFilter
  //       aggregations={aggregations}
  //       filters={filters}
  //       onClearFilter={onClearFilter}
  //       onSelectAllFilter={onSelectAllFilter}
  //       onSelectHandler={onSelectHandler}
  //     />
  //   );
  //   const serviceNameAgg = getByTestId(container, aggregations[3].title);
  //
  //   for (let index = 0; index < aggregations[3].buckets.length; index++) {
  //     const element = aggregations[3].buckets[index];
  //
  //     expect(
  //       getByTestId(serviceNameAgg, `filter-container-${element.key}`)
  //     ).toBeInTheDocument();
  //   }
  // });
  //
  // it('Should render all filters for database', () => {
  //   const { container } = render(
  //     <FacetFilter
  //       aggregations={aggregations}
  //       filters={filters}
  //       onClearFilter={onClearFilter}
  //       onSelectAllFilter={onSelectAllFilter}
  //       onSelectHandler={onSelectHandler}
  //     />
  //   );
  //   const serviceNameAgg = getByTestId(container, aggregations[4].title);
  //
  //   for (let index = 0; index < aggregations[4].buckets.length; index++) {
  //     const element = aggregations[4].buckets[index];
  //
  //     expect(
  //       getByTestId(serviceNameAgg, `filter-container-${element.key}`)
  //     ).toBeInTheDocument();
  //   }
  // });
  //
  // it('Should render all filters for database schema', () => {
  //   const { container } = render(
  //     <FacetFilter
  //       aggregations={aggregations}
  //       filters={filters}
  //       onClearFilter={onClearFilter}
  //       onSelectAllFilter={onSelectAllFilter}
  //       onSelectHandler={onSelectHandler}
  //     />
  //   );
  //   const serviceNameAgg = getByTestId(container, aggregations[5].title);
  //
  //   for (let index = 0; index < aggregations[5].buckets.length; index++) {
  //     const element = aggregations[5].buckets[index];
  //
  //     expect(
  //       getByTestId(serviceNameAgg, `filter-container-${element.key}`)
  //     ).toBeInTheDocument();
  //   }
  // });
});

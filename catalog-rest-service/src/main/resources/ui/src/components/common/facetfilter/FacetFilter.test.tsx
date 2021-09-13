import { getAllByTestId, render } from '@testing-library/react';
import React from 'react';
import FacetFilter from './FacetFilter';

const onSelectHandler = jest.fn();
const aggregations = [
  {
    title: 'Filter 1',
    buckets: [{ key: 'test', doc_count: 5 }],
  },
  {
    title: 'Filter 2',
    buckets: [{ key: 'test', doc_count: 5 }],
  },
  {
    title: 'Filter 3',
    buckets: [{ key: 'test', doc_count: 5 }],
  },
];
const filters = {
  tags: ['test', 'test2'],
  service: ['test', 'test2'],
  'service type': ['test', 'test2'],
  tier: ['test', 'test2'],
};

describe('Test FacetFilter Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onSelectHandler={onSelectHandler}
      />
    );
    const filterHeading = getAllByTestId(container, 'filter-heading');

    expect(filterHeading.length).toBe(3);
  });
});

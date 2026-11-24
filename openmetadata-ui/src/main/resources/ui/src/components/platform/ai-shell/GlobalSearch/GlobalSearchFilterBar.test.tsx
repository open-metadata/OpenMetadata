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
import { render, screen } from '@testing-library/react';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { ExploreQuickFiltersProps } from '../../../Explore/ExploreQuickFilters.interface';
import GlobalSearchFilterBar from './GlobalSearchFilterBar';

const mockQuickFilters = jest.fn();

jest.mock('../../../Explore/ExploreQuickFilters', () => ({
  __esModule: true,
  default: (props: ExploreQuickFiltersProps) => {
    mockQuickFilters(props);

    return <div data-testid="explore-quick-filters" />;
  },
}));

const lastProps = (): ExploreQuickFiltersProps =>
  mockQuickFilters.mock.calls[mockQuickFilters.mock.calls.length - 1][0];

describe('GlobalSearchFilterBar', () => {
  beforeEach(() => {
    mockQuickFilters.mockClear();
  });

  it('renders nothing without a tab or for a type without filters', () => {
    const { rerender } = render(
      <GlobalSearchFilterBar
        facets={{}}
        query="customer"
        onFacetChange={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('global-search-filter-bar')
    ).not.toBeInTheDocument();

    rerender(
      <GlobalSearchFilterBar
        category="user"
        facets={{}}
        query="customer"
        onFacetChange={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('global-search-filter-bar')
    ).not.toBeInTheDocument();
  });

  it('shows the glossary term filters narrowed to the query, with the selection', () => {
    const onFacetChange = jest.fn();
    render(
      <GlobalSearchFilterBar
        category="glossaryTerm"
        facets={{
          [EntityFields.OWNERS]: [{ key: 'Finance', label: 'Finance' }],
        }}
        query="customer"
        onFacetChange={onFacetChange}
      />
    );

    const props = lastProps();

    expect(screen.getByTestId('global-search-filter-bar')).toBeInTheDocument();
    expect(props.index).toBe(SearchIndex.GLOSSARY_TERM);
    expect(props.searchText).toBe('customer');
    expect(props.immediateApply).toBe(true);
    expect(props.onFieldValueSelect).toBe(onFacetChange);
    expect(
      props.fields.find((field) => field.key === EntityFields.OWNERS)?.value
    ).toEqual([{ key: 'Finance', label: 'Finance' }]);
  });

  it('shows the Domains listing filters on the domain tab', () => {
    render(
      <GlobalSearchFilterBar
        category="domain"
        facets={{}}
        query="customer"
        onFacetChange={jest.fn()}
      />
    );

    expect(lastProps().index).toBe(SearchIndex.DOMAIN);
    expect(lastProps().fields.map((field) => field.key)).toContain(
      EntityFields.DOMAIN_TYPE
    );
  });
});

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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { getAggregateFieldOptions } from '../../../../rest/miscAPI';
import GlobalSearchFilterBar from './GlobalSearchFilterBar';

jest.mock('../../../../rest/miscAPI', () => ({
  ...jest.requireActual('../../../../rest/miscAPI'),
  getAggregateFieldOptions: jest.fn(),
}));

// The advanced-search context is mounted by the Explore page, not the modal.
jest.mock(
  '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({ useAdvanceSearch: () => ({ queryFilter: undefined }) })
);

const renderBar = (category?: string, hostUrl = '/') =>
  render(
    <MemoryRouter initialEntries={[hostUrl]}>
      <GlobalSearchFilterBar
        category={category}
        facets={{}}
        query="customer"
        onFacetChange={jest.fn()}
      />
    </MemoryRouter>
  );

describe('GlobalSearchFilterBar', () => {
  beforeEach(() => {
    (getAggregateFieldOptions as jest.Mock).mockResolvedValue({
      data: { aggregations: {} },
    });
  });

  it('renders nothing without a tab or for a type without filters', () => {
    const { unmount } = renderBar();

    expect(
      screen.queryByTestId('global-search-filter-bar')
    ).not.toBeInTheDocument();

    unmount();
    renderBar('user');

    expect(
      screen.queryByTestId('global-search-filter-bar')
    ).not.toBeInTheDocument();
  });

  it('shows the Domains listing filters on the domain tab', () => {
    renderBar('domain');

    expect(
      screen.getByTestId(`search-dropdown-${EntityFields.DOMAIN_TYPE}`)
    ).toBeInTheDocument();
  });

  it('counts a glossary term filter for the typed query, ignoring the page behind', async () => {
    // The host page shows deleted entities; the search's facets must not.
    renderBar('glossaryTerm', '/explore?showDeleted=true');

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`search-dropdown-${EntityFields.OWNERS}`)
      );
    });

    expect(getAggregateFieldOptions).toHaveBeenCalledWith(
      SearchIndex.GLOSSARY_TERM,
      EntityFields.OWNERS,
      '',
      expect.stringContaining('"deleted":false'),
      EntityFields.OWNERS,
      false,
      false,
      'customer'
    );
  });
});

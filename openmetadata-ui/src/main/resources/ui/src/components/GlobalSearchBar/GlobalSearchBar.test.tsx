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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchIndex } from '../../enums/search.enum';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { GlobalSearchBar } from './GlobalSearchBar';

jest.mock('../../context/TourProvider/TourProvider', () => ({
  useTourProvider: () => ({
    isTourOpen: false,
    updateTourPage: jest.fn(),
    updateTourSearch: jest.fn(),
  }),
}));

// The popover content is where the search request is built; render the index
// it would query so the test can follow the selector into it.
jest.mock('../AppBar/Suggestions', () =>
  jest.fn(({ searchCriteria }: { searchCriteria?: SearchIndex }) => (
    <div data-testid="suggestions-index">
      {searchCriteria ?? SearchIndex.DATA_ASSET}
    </div>
  ))
);

jest.mock('../AppBar/SearchOptions', () => jest.fn(() => null));

const renderBar = () =>
  render(
    <MemoryRouter initialEntries={['/explore']}>
      <GlobalSearchBar />
    </MemoryRouter>
  );

const typeSearch = (text: string) => {
  const input = screen.getByTestId('searchBox');
  fireEvent.click(input);
  fireEvent.change(input, { target: { value: text } });
};

describe('GlobalSearchBar', () => {
  beforeEach(() => {
    act(() => useApplicationStore.getState().updateSearchCriteria(''));
  });

  it('searches every data asset when "All" is selected', () => {
    renderBar();

    expect(screen.getByTestId('global-search-selector')).toHaveTextContent(
      'label.all'
    );

    typeSearch('dim');

    expect(screen.getByTestId('suggestions-index')).toHaveTextContent(
      SearchIndex.DATA_ASSET
    );
  });

  it.each([
    ['label.database', SearchIndex.DATABASE],
    ['label.table', SearchIndex.TABLE],
    ['label.database-schema', SearchIndex.DATABASE_SCHEMA],
    ['label.topic', SearchIndex.TOPIC],
  ])(
    'searches the %s index once it is selected',
    async (label, searchIndex) => {
      renderBar();

      fireEvent.click(
        within(screen.getByTestId('global-search-selector')).getByRole('button')
      );
      fireEvent.click(
        await screen.findByTestId(`global-search-select-option-${label}`)
      );

      expect(
        within(screen.getByTestId('global-search-selector')).getByRole('button')
      ).toHaveTextContent(label);

      typeSearch('dim');

      expect(screen.getByTestId('suggestions-index')).toHaveTextContent(
        searchIndex
      );
    }
  );
});

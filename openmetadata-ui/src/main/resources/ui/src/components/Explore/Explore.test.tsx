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

import { findAllByTestId, findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import {
  INITIAL_SORT_FIELD,
  INITIAL_SORT_ORDER,
} from '../../constants/explore.constants';
import { SearchIndex } from '../../enums/search.enum';
import { mockResponse } from './exlore.mock';
import Explore from './Explore.component';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest
    .fn()
    .mockImplementation(() => ({ search: '', pathname: '/explore' })),
  useParams: jest.fn().mockReturnValue({
    tab: 'tab',
  }),
}));

jest.mock('../../utils/FilterUtils', () => ({
  getFilterString: jest.fn().mockImplementation(() => 'user.address'),
  getFilterCount: jest.fn().mockImplementation(() => 10),
}));

jest.mock('components/searched-data/SearchedData', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div data-testid="search-data">
        <div data-testid="wrapped-content">{children}</div>
      </div>
    ));
});

jest.mock('./EntitySummaryPanel/EntitySummaryPanel.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="EntitySummaryPanel">EntitySummaryPanel</div>
    ))
);

const mockFunction = jest.fn();

jest.mock('../containers/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

describe('Test Explore component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <Explore
        showDeleted
        searchIndex={SearchIndex.TABLE}
        searchResults={mockResponse}
        sortOrder={INITIAL_SORT_ORDER}
        sortValue={INITIAL_SORT_FIELD}
        tabCounts={{
          [SearchIndex.TABLE]: 15,
          [SearchIndex.TOPIC]: 2,
          [SearchIndex.DASHBOARD]: 8,
          [SearchIndex.PIPELINE]: 5,
          [SearchIndex.MLMODEL]: 2,
          [SearchIndex.CONTAINER]: 7,
        }}
        onChangeAdvancedSearchQueryFilter={mockFunction}
        onChangePostFilter={mockFunction}
        onChangeSearchIndex={mockFunction}
        onChangeShowDeleted={mockFunction}
        onChangeSortOder={mockFunction}
        onChangeSortValue={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const searchData = await findByTestId(container, 'search-data');
    const wrappedContent = await findByTestId(container, 'wrapped-content');
    // Here regular expression '/-tab/i' is used to match all the tabs
    // Example, Tab for Table assets will have data-testid='tables-tab'
    const tabs = await findAllByTestId(container, /-tab/i);

    expect(searchData).toBeInTheDocument();
    expect(wrappedContent).toBeInTheDocument();
    expect(tabs).toHaveLength(6);
  });
});

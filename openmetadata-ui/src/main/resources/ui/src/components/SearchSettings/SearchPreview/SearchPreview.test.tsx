/*
 *  Copyright 2025 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { searchQuery } from '../../../rest/searchAPI';
import SearchPreview from './SearchPreview';

const mockHistoryPush = jest.fn();
const mockLocation = {
  pathname: '/search',
  search: '',
  hash: '',
  state: {},
};

const mockSearchResponse = {
  hits: {
    hits: [
      {
        _id: '1',
        _source: {
          name: 'test_table',
          displayName: 'Test Table',
          description: 'Test Description',
        },
      },
    ],
    total: { value: 1 },
  },
};

jest.mock('react-router-dom', () => ({
  useParams: () => ({ entityType: 'table' }),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
  useLocation: () => mockLocation,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>);
});

jest.mock('../../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious</div>);
});

jest.mock('../../ExploreV1/ExploreSearchCard/ExploreSearchCard', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="searched-data-card">ExploreSearchCard</div>
    ));
});

jest.mock('../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});

describe('SearchPreview', () => {
  beforeEach(() => {
    (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Should render search preview component', async () => {
    render(<SearchPreview />);

    expect(screen.getByTestId('search-preview')).toBeInTheDocument();
    expect(screen.getByTestId('searchbar')).toBeInTheDocument();

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledTimes(1);
    });
  });

  it('Should display search results', async () => {
    render(<SearchPreview />);

    await waitFor(() => {
      expect(screen.getByTestId('searched-data-card')).toBeInTheDocument();
    });
  });

  it('Should handle search input changes', async () => {
    render(<SearchPreview />);

    const searchInput = screen.getByTestId('searchbar');

    fireEvent.change(searchInput, { target: { value: 'test search' } });

    await waitFor(
      () => {
        expect(searchQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            query: '*test search*',
            searchIndex: ['table'],
          })
        );
      },
      { timeout: 1500 }
    );
  });
});

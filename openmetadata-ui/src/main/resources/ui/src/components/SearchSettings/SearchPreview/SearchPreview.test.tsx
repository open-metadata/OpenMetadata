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
import { SearchSettings } from '../../../generated/api/search/previewSearchRequest';
import { searchPreview } from '../../../rest/searchAPI';
import SearchPreview from './SearchPreview';

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: jest.fn((fn) => {
    const mockFn = function (...args: any[]) {
      return fn(...args);
    };
    mockFn.cancel = jest.fn();

    return mockFn;
  }),
}));

const mockSearchConfig: SearchSettings = {
  globalSettings: {
    enableAccessControl: true,
    highlightFields: ['description'],
    fieldValueBoosts: [],
  },
};

const mockProps = {
  handleRestoreDefaults: jest.fn(),
  handleSaveChanges: jest.fn(),
  isSaving: false,
  disabledSave: false,
  searchConfig: mockSearchConfig,
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
        _score: 1.0,
      },
    ],
    total: { value: 1 },
  },
};

jest.mock('react-router-dom', () => ({
  useParams: () => ({ fqn: 'table' }),
  useLocation: () => ({
    pathname: '/search',
    search: '',
    hash: '',
    state: {},
  }),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchPreview: jest.fn(),
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
    (searchPreview as jest.Mock).mockResolvedValue(mockSearchResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Should render search preview component', () => {
    render(<SearchPreview {...mockProps} />);

    expect(screen.getByTestId('search-preview')).toBeInTheDocument();
    expect(screen.getByTestId('searchbar')).toBeInTheDocument();

    expect(searchPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        searchSettings: mockSearchConfig,
      })
    );
  });

  it('Should display search results', async () => {
    render(<SearchPreview {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('searched-data-card')).toBeInTheDocument();
    });

    expect(searchPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        searchSettings: mockSearchConfig,
      })
    );
  });

  it('Should handle search input changes', () => {
    (searchPreview as jest.Mock).mockClear();

    render(<SearchPreview {...mockProps} />);

    // Initial fetch is made on component mount
    expect(searchPreview).toHaveBeenCalledTimes(1);

    // The first call should have empty query
    expect(searchPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: '',
        searchSettings: mockSearchConfig,
      })
    );

    // Clear the mock to focus only on the search input change
    (searchPreview as jest.Mock).mockClear();

    // Set up the mock to return data for the search term
    (searchPreview as jest.Mock).mockResolvedValueOnce(mockSearchResponse);

    // Input a search term
    const searchInput = screen.getByTestId('searchbar');
    fireEvent.change(searchInput, { target: { value: 'test search' } });

    // verify the call
    expect(searchPreview).toHaveBeenCalledTimes(1);
    expect(searchPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'test search',
        searchSettings: mockSearchConfig,
      })
    );
  });
});

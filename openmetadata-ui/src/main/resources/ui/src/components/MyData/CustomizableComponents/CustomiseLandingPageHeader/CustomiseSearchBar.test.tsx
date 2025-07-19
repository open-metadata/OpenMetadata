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
import { fireEvent, render, screen } from '@testing-library/react';
import { useTourProvider } from '../../../../context/TourProvider/TourProvider';
import { EntityTabs } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { CurrentTourPageType } from '../../../../enums/tour.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useSearchStore } from '../../../../hooks/useSearchStore';
import { TabsInfoData } from '../../../../pages/ExplorePage/ExplorePage.interface';
import { addToRecentSearched } from '../../../../utils/CommonUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { ExploreSearchIndex } from '../../../Explore/ExplorePage.interface';
import CustomiseSearchBar from './CustomiseSearchBar';

jest.mock('../../../../hooks/useApplicationStore');
jest.mock('../../../../hooks/useSearchStore');
jest.mock('../../../../context/TourProvider/TourProvider');
jest.mock('../../../../hooks/useCustomLocation/useCustomLocation');
jest.mock('../../../../utils/CommonUtils');
jest.mock('../../../../utils/SearchClassBase');

// Create typed mocks
const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;
const mockUseSearchStore = useSearchStore as jest.MockedFunction<
  typeof useSearchStore
>;
const mockUseTourProvider = useTourProvider as jest.MockedFunction<
  typeof useTourProvider
>;
const mockUseCustomLocation = useCustomLocation as jest.MockedFunction<
  typeof useCustomLocation
>;
const mockAddToRecentSearched = addToRecentSearched as jest.MockedFunction<
  typeof addToRecentSearched
>;
const mockSearchClassBase = searchClassBase as jest.Mocked<
  typeof searchClassBase
>;

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock AppBar components
jest.mock('../../../AppBar/SearchOptions', () => {
  return function MockSearchOptions() {
    return <div data-testid="search-options">Search Options</div>;
  };
});

jest.mock('../../../AppBar/Suggestions', () => {
  return function MockSuggestions() {
    return <div data-testid="suggestions">Suggestions</div>;
  };
});

describe('CustomiseSearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set default mock implementations
    mockUseApplicationStore.mockReturnValue({
      searchCriteria: SearchIndex.TABLE,
    });

    mockUseSearchStore.mockReturnValue({
      isNLPEnabled: false,
      isNLPActive: false,
      setNLPActive: jest.fn(),
    });

    mockUseTourProvider.mockReturnValue({
      isTourOpen: false,
      isTourPage: false,
      currentTourPage: CurrentTourPageType.MY_DATA_PAGE,
      activeTabForTourDatasetPage: EntityTabs.SCHEMA,
      tourSearchValue: '',
      updateIsTourOpen: jest.fn(),
      updateTourPage: jest.fn(),
      updateActiveTab: jest.fn(),
      updateTourSearch: jest.fn(),
    });

    mockUseCustomLocation.mockReturnValue({
      pathname: '/explore',
      search: '',
      state: undefined,
      key: '',
      hash: '',
    });

    mockSearchClassBase.getTabsInfo.mockReturnValue({
      [SearchIndex.TABLE]: {
        label: 'Tables',
        sortingFields: [],
        sortField: 'name',
        path: 'tables',
        icon: jest.fn(),
      },
    } as unknown as Record<ExploreSearchIndex, TabsInfoData>);
  });

  it('should render the search input', () => {
    render(<CustomiseSearchBar />);

    expect(screen.getByTestId('customise-searchbox')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('label.search-for-type')
    ).toBeInTheDocument();
  });

  it('should not render NLP button when NLP is disabled', () => {
    mockUseSearchStore.mockReturnValue({
      isNLPEnabled: false,
      isNLPActive: false,
      setNLPActive: jest.fn(),
    });

    render(<CustomiseSearchBar />);

    expect(
      screen.queryByTestId('nlp-suggestions-button')
    ).not.toBeInTheDocument();
  });

  it('should render NLP button when NLP is enabled', () => {
    mockUseSearchStore.mockReturnValue({
      isNLPEnabled: true,
      isNLPActive: false,
      setNLPActive: jest.fn(),
    });

    render(<CustomiseSearchBar />);

    expect(screen.getByTestId('nlp-suggestions-button')).toBeInTheDocument();
  });

  it('should show active state when NLP is active', () => {
    mockUseSearchStore.mockReturnValue({
      isNLPEnabled: true,
      isNLPActive: true,
      setNLPActive: jest.fn(),
    });

    render(<CustomiseSearchBar />);

    const nlpButton = screen.getByTestId('nlp-suggestions-button');

    expect(nlpButton).toHaveClass('active');
  });

  it('should toggle NLP state when NLP button is clicked', () => {
    const mockSetNLPActive = jest.fn();
    mockUseSearchStore.mockReturnValue({
      isNLPEnabled: true,
      isNLPActive: false,
      setNLPActive: mockSetNLPActive,
    });

    render(<CustomiseSearchBar />);

    const nlpButton = screen.getByTestId('nlp-suggestions-button');
    fireEvent.click(nlpButton);

    expect(mockSetNLPActive).toHaveBeenCalledWith(true);
  });

  it('should handle search input change', () => {
    render(<CustomiseSearchBar />);

    const searchInput = screen.getByTestId('customise-searchbox');
    fireEvent.change(searchInput, { target: { value: 'test search' } });

    expect(searchInput).toHaveValue('test search');
  });

  it('should handle Enter key press for search', () => {
    render(<CustomiseSearchBar />);

    const searchInput = screen.getByTestId('customise-searchbox');
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    expect(mockAddToRecentSearched).toHaveBeenCalledWith('test search');
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should initialize with search value from URL query params', () => {
    mockUseCustomLocation.mockReturnValue({
      pathname: '/explore',
      search: '?search=initial+search',
      state: undefined,
      key: '',
      hash: '',
    });

    render(<CustomiseSearchBar />);

    const searchInput = screen.getByTestId('customise-searchbox');

    expect(searchInput).toHaveValue('initial search');
  });
});

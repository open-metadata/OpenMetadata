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
/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { SearchIndex } from '../../enums/search.enum';
import { searchQuery } from '../../rest/searchAPI';
import Suggestions from './Suggestions';

// Mock dependencies
jest.mock('../../rest/searchAPI');
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));
jest.mock('../../context/TourProvider/TourProvider');
jest.mock('../../utils/SearchUtils', () => ({
  filterOptionsByIndex: jest.fn((options, index) => {
    return options.filter((option: any) => option._index === index);
  }),
  getGroupLabel: jest.fn((index) => `Group ${index}`),
  getSuggestionElement: jest.fn((suggestion) => (
    <div data-testid={`suggestion-${suggestion._id}`} key={suggestion._id}>
      {suggestion._source.name}
    </div>
  )),
}));
jest.mock('../../utils/SearchClassBase', () => ({
  getEntitiesSuggestions: jest.fn(() => []),
}));
jest.mock('../../utils/CommonUtils', () => ({
  Transi18next: ({ i18nKey, values }: { i18nKey: string; values: any }) => (
    <span data-testid="transi18next">
      {i18nKey} {values?.keyword || ''}
    </span>
  ),
}));

// Mock location.search for the component
Object.defineProperty(window, 'location', {
  value: {
    search: '',
  },
  writable: true,
});

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;
const mockUseTranslation = useTranslation as jest.MockedFunction<
  typeof useTranslation
>;
const mockUseTourProvider = useTourProvider as jest.MockedFunction<
  typeof useTourProvider
>;

const defaultProps = {
  searchText: 'test',
  setIsOpen: jest.fn(),
  isOpen: true,
  searchCriteria: SearchIndex.TABLE,
  isNLPActive: false,
  onSearchTextUpdate: jest.fn(),
};

describe('Suggestions Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslation.mockReturnValue({
      t: jest.fn((key: string) => key),
      i18n: { language: 'en' },
    } as any);
    mockUseTourProvider.mockReturnValue({
      isTourOpen: false,
      updateTourPage: jest.fn(),
      updateTourSearch: jest.fn(),
    } as any);
  });

  describe('AI Query Suggestions', () => {
    it('should render all AI query suggestions', () => {
      render(<Suggestions {...defaultProps} isNLPActive searchText="" />);

      const aiQueries = [
        'Tables owned by marketing',
        'Tables with Tier1 classification',
        'Find dashboards tagged with PII.Sensitive',
        'Topics with schema fields containing address',
        'Tables tagged with tier1 or tier2',
      ];

      aiQueries.forEach((query) => {
        expect(screen.getByText(query)).toBeInTheDocument();
      });
    });

    it('should call onSearchTextUpdate when AI query button is clicked', () => {
      const mockOnSearchTextUpdate = jest.fn();

      render(
        <Suggestions
          {...defaultProps}
          isNLPActive
          searchText=""
          onSearchTextUpdate={mockOnSearchTextUpdate}
        />
      );

      const firstQueryButton = screen.getByText('Tables owned by marketing');
      fireEvent.click(firstQueryButton);

      expect(mockOnSearchTextUpdate).toHaveBeenCalledWith(
        'Tables owned by marketing'
      );
    });
  });

  describe('Props Handling', () => {
    it('should handle empty searchText', () => {
      render(<Suggestions {...defaultProps} searchText="" />);

      expect(mockSearchQuery).not.toHaveBeenCalled();
    });

    it('should handle isNLPActive prop correctly', () => {
      render(<Suggestions {...defaultProps} isNLPActive />);

      expect(mockSearchQuery).not.toHaveBeenCalled();
    });
  });

  describe('Component Behavior', () => {
    it('should show no results message when searchText is provided but no results', () => {
      render(<Suggestions {...defaultProps} />);

      // The component should show the no results message
      expect(screen.getByTestId('transi18next')).toBeInTheDocument();
    });

    it('should not call searchQuery when tour is open', () => {
      mockUseTourProvider.mockReturnValue({
        isTourOpen: true,
        updateTourPage: jest.fn(),
        updateTourSearch: jest.fn(),
      } as any);

      render(<Suggestions {...defaultProps} />);

      expect(mockSearchQuery).not.toHaveBeenCalled();
    });
  });
});

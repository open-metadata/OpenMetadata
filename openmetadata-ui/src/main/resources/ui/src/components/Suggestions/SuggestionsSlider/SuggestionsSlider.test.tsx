/*
 *  Copyright 2024 Collate.
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
import { useSuggestionsContext } from '../SuggestionsProvider/SuggestionsProvider';
import { SuggestionAction } from '../SuggestionsProvider/SuggestionsProvider.interface';
import SuggestionsSlider from './SuggestionsSlider';

const mockAcceptRejectAllSuggestions = jest.fn();
const mockFetchSuggestions = jest.fn();

jest.mock('../SuggestionsProvider/SuggestionsProvider', () => ({
  useSuggestionsContext: jest.fn(),
}));

jest.mock('../../common/AvatarCarousel/AvatarCarousel', () => {
  return jest.fn(() => <p>Avatar Carousel</p>);
});

const mockContextValue = {
  suggestions: [{ id: '1' }, { id: '2' }],
  selectedUserSuggestions: {
    combinedData: [{ id: '1' }, { id: '2' }],
    tags: [],
    description: [],
  },
  suggestionLimit: 2,
  suggestionPendingCount: 0,
  acceptRejectAllSuggestions: mockAcceptRejectAllSuggestions,
  fetchSuggestions: mockFetchSuggestions,
  loadingAccept: false,
  loadingReject: false,
  loading: false,
  allSuggestionsUsers: [
    { id: '1', name: 'User 1', type: 'user' },
    { id: '2', name: 'User 2', type: 'user' },
  ],
  suggestionsByUser: new Map(),
  entityFqn: 'test.entity',
  onUpdateActiveUser: jest.fn(),
  fetchSuggestionsByUserId: jest.fn(),
  acceptRejectSuggestion: jest.fn(),
};

describe('SuggestionsSlider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSuggestionsContext as jest.Mock).mockReturnValue(mockContextValue);
  });

  it('renders buttons when there are selected user suggestions', () => {
    render(<SuggestionsSlider />);

    expect(screen.getByTestId('accept-all-suggestions')).toBeInTheDocument();
    expect(screen.getByTestId('reject-all-suggestions')).toBeInTheDocument();
  });

  it('calls acceptRejectAllSuggestions with correct action on accept button click', () => {
    render(<SuggestionsSlider />);

    fireEvent.click(screen.getByTestId('accept-all-suggestions'));

    expect(mockAcceptRejectAllSuggestions).toHaveBeenCalledWith(
      SuggestionAction.Accept
    );
  });

  it('calls acceptRejectAllSuggestions with correct action on reject button click', () => {
    render(<SuggestionsSlider />);

    fireEvent.click(screen.getByTestId('reject-all-suggestions'));

    expect(mockAcceptRejectAllSuggestions).toHaveBeenCalledWith(
      SuggestionAction.Reject
    );
  });

  it('should not render more suggestion button when suggestionPendingCount is 0', () => {
    render(<SuggestionsSlider />);

    expect(
      screen.queryByTestId('more-suggestion-button')
    ).not.toBeInTheDocument();
  });

  it('should not render more suggestion button when suggestionPendingCount is negative', () => {
    (useSuggestionsContext as jest.Mock).mockReturnValue({
      ...mockContextValue,
      suggestionPendingCount: -5,
    });

    render(<SuggestionsSlider />);

    expect(
      screen.queryByTestId('more-suggestion-button')
    ).not.toBeInTheDocument();
  });

  it('should show the more suggestion button when there are pending suggestions', () => {
    (useSuggestionsContext as jest.Mock).mockReturnValue({
      ...mockContextValue,
      suggestionPendingCount: 15, // More suggestions available
    });

    render(<SuggestionsSlider />);

    expect(screen.getByTestId('more-suggestion-button')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('more-suggestion-button'));

    expect(mockFetchSuggestions).toHaveBeenCalled();
  });

  it('should display loading states correctly for accept action', () => {
    (useSuggestionsContext as jest.Mock).mockReturnValue({
      ...mockContextValue,
      loadingAccept: true,
    });

    render(<SuggestionsSlider />);

    const acceptButton = screen.getByTestId('accept-all-suggestions');

    expect(acceptButton).toBeDisabled();
  });

  it('should display loading states correctly for reject action', () => {
    (useSuggestionsContext as jest.Mock).mockReturnValue({
      ...mockContextValue,
      loadingReject: true,
    });

    render(<SuggestionsSlider />);

    const rejectButton = screen.getByTestId('reject-all-suggestions');

    expect(rejectButton).toBeDisabled();
  });

  it('should hide action buttons when there are no suggestions', () => {
    (useSuggestionsContext as jest.Mock).mockReturnValue({
      ...mockContextValue,
      selectedUserSuggestions: {
        combinedData: [],
        tags: [],
        description: [],
      },
    });

    render(<SuggestionsSlider />);

    expect(
      screen.queryByTestId('accept-all-suggestions')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('reject-all-suggestions')
    ).not.toBeInTheDocument();
  });

  it('should render avatar carousel component', () => {
    render(<SuggestionsSlider />);

    expect(screen.getByText('Avatar Carousel')).toBeInTheDocument();
  });

  it('should handle component render with minimal context data', () => {
    (useSuggestionsContext as jest.Mock).mockReturnValue({
      ...mockContextValue,
      suggestions: [],
      allSuggestionsUsers: [],
      selectedUserSuggestions: {
        combinedData: [],
        tags: [],
        description: [],
      },
    });

    render(<SuggestionsSlider />);

    // Component should render without errors even with empty data
    expect(screen.getByText('Avatar Carousel')).toBeInTheDocument();
  });

  it('should call fetchSuggestions with correct parameters when more suggestions button is clicked', () => {
    (useSuggestionsContext as jest.Mock).mockReturnValue({
      ...mockContextValue,
      suggestionPendingCount: 10,
    });

    render(<SuggestionsSlider />);

    const moreButton = screen.getByTestId('more-suggestion-button');
    fireEvent.click(moreButton);

    expect(mockFetchSuggestions).toHaveBeenCalledTimes(1);
    // Check that it's called without parameters (default behavior)
    expect(mockFetchSuggestions).toHaveBeenCalledWith();
  });
});

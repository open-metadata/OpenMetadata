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
import SuggestionsSlider from './SuggestionsSlider';

const acceptRejectAllSuggestions = jest.fn();
const fetchSuggestions = jest.fn();

jest.mock('../SuggestionsProvider/SuggestionsProvider', () => ({
  useSuggestionsContext: jest.fn(),
}));

jest.mock('../../common/AvatarCarousel/AvatarCarousel', () => {
  return jest.fn(() => <p>Avatar Carousel</p>);
});

jest.mock('../SuggestionsProvider/SuggestionsProvider', () => ({
  useSuggestionsContext: jest.fn().mockImplementation(() => ({
    suggestions: [{ id: '1' }, { id: '2' }],
    selectedUserSuggestions: { combinedData: [{ id: '1' }, { id: '2' }] },
    suggestionLimit: 2,
    acceptRejectAllSuggestions,
    fetchSuggestions,
    loadingAccept: false,
    loadingReject: false,
  })),
  __esModule: true,
  default: 'SuggestionsProvider',
}));

describe('SuggestionsSlider', () => {
  it('renders buttons when there are selected user suggestions', () => {
    render(<SuggestionsSlider />);

    expect(screen.getByTestId('accept-all-suggestions')).toBeInTheDocument();
    expect(screen.getByTestId('reject-all-suggestions')).toBeInTheDocument();
  });

  it('calls acceptRejectAllSuggestions on button click', () => {
    render(<SuggestionsSlider />);
    fireEvent.click(screen.getByTestId('accept-all-suggestions'));

    expect(acceptRejectAllSuggestions).toHaveBeenCalled();
  });

  it('should not renders more suggestion button if limit is match', () => {
    render(<SuggestionsSlider />);

    expect(
      screen.queryByTestId('more-suggestion-button')
    ).not.toBeInTheDocument();
  });

  it("should show the more suggestion if limit and suggestion doesn't match", () => {
    (useSuggestionsContext as jest.Mock).mockReturnValueOnce({
      suggestions: [{ id: '1' }, { id: '2' }],
      selectedUserSuggestions: { combinedData: [{ id: '1' }, { id: '2' }] },
      suggestionLimit: 20,
      acceptRejectAllSuggestions,
      fetchSuggestions,
      loadingAccept: false,
      loadingReject: false,
    });

    render(<SuggestionsSlider />);

    expect(screen.getByTestId('more-suggestion-button')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('more-suggestion-button'));

    expect(fetchSuggestions).toHaveBeenCalled();
  });
});

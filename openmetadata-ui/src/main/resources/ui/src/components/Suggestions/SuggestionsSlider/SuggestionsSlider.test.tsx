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
import React from 'react';
import { useSuggestionsContext } from '../SuggestionsProvider/SuggestionsProvider';
import SuggestionsSlider from './SuggestionsSlider';

jest.mock('../SuggestionsProvider/SuggestionsProvider', () => ({
  useSuggestionsContext: jest.fn(),
}));

jest.mock('../../common/AvatarCarousel/AvatarCarousel', () => {
  return jest.fn(() => <p>Avatar Carousel</p>);
});

describe('SuggestionsSlider', () => {
  it('renders buttons when there are selected user suggestions', () => {
    (useSuggestionsContext as jest.Mock).mockReturnValue({
      selectedUserSuggestions: [{ id: '1' }, { id: '2' }],
      acceptRejectAllSuggestions: jest.fn(),
      loadingAccept: false,
      loadingReject: false,
    });

    render(<SuggestionsSlider />);

    expect(screen.getByTestId('accept-all-suggestions')).toBeInTheDocument();
    expect(screen.getByTestId('reject-all-suggestions')).toBeInTheDocument();
  });

  it('calls acceptRejectAllSuggestions on button click', () => {
    const acceptRejectAllSuggestions = jest.fn();
    (useSuggestionsContext as jest.Mock).mockReturnValue({
      selectedUserSuggestions: [{ id: '1' }, { id: '2' }],
      acceptRejectAllSuggestions,
      loadingAccept: false,
      loadingReject: false,
    });

    render(<SuggestionsSlider />);
    fireEvent.click(screen.getByTestId('accept-all-suggestions'));

    expect(acceptRejectAllSuggestions).toHaveBeenCalled();
  });
});

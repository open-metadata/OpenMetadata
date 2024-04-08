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
import { render, screen } from '@testing-library/react';
import React from 'react';
import AvatarCarousel from './AvatarCarousel';

const suggestions = [
  {
    id: '1',
    description: 'Test suggestion',
    createdBy: { id: '1', name: 'Avatar 1', type: 'user' },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  },
  {
    id: '2',
    description: 'Test suggestion',
    createdBy: { id: '2', name: 'Avatar 2', type: 'user' },
    entityLink: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
  },
];

const suggByUser = new Map([
  ['Avatar 1', [suggestions[0]]],
  ['Avatar 2', [suggestions[1]]],
]);

jest.mock('../../Suggestions/SuggestionsProvider/SuggestionsProvider', () => ({
  useSuggestionsContext: jest.fn().mockImplementation(() => ({
    suggestions: suggestions,
    suggestionsByUser: suggByUser,
    allSuggestionsUsers: [
      { id: '1', name: 'Avatar 1', type: 'user' },
      { id: '2', name: 'Avatar 2', type: 'user' },
    ],
    acceptRejectSuggestion: jest.fn(),
    selectedUserSuggestions: [],
    onUpdateActiveUser: jest.fn(),
  })),
  __esModule: true,
  default: 'SuggestionsProvider',
}));

jest.mock('../ProfilePicture/ProfilePicture', () =>
  jest
    .fn()
    .mockImplementation(({ name }) => (
      <span data-testid="mocked-profile-picture">{name}</span>
    ))
);

jest.mock('../../../rest/suggestionsAPI', () => ({
  getSuggestionsList: jest
    .fn()
    .mockImplementation(() => Promise.resolve(suggestions)),
}));

describe('AvatarCarousel', () => {
  it('renders without crashing', () => {
    render(<AvatarCarousel showArrows />);

    expect(screen.getByText(/Avatar 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Avatar 2/i)).toBeInTheDocument();
    expect(screen.getByTestId('prev-slide')).toBeDisabled();
  });
});

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
import { render } from '@testing-library/react';
import { EntityReference } from '../../../generated/entity/type';
import AvatarCarouselItem from './AvatarCarouselItem';

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

jest.mock('../../../rest/suggestionsAPI', () => ({
  getSuggestionsList: jest
    .fn()
    .mockImplementation(() => Promise.resolve(suggestions)),
}));

describe('AvatarCarouselItem', () => {
  const avatar: EntityReference = {
    id: '1',
    name: 'Test Avatar',
    type: 'user',
  };
  const index = 0;
  const onAvatarClick = jest.fn();
  const avatarBtnRefs = { current: [] };
  const isActive = false;

  it('renders AvatarCarouselItem with ProfilePicture component', () => {
    const { getByTestId } = render(
      <AvatarCarouselItem
        avatar={avatar}
        avatarBtnRefs={avatarBtnRefs}
        index={index}
        isActive={isActive}
        onAvatarClick={onAvatarClick}
      />
    );

    expect(
      getByTestId(`avatar-carousel-item-${avatar.id}`)
    ).toBeInTheDocument();
  });

  it('calls onAvatarClick function when clicked', () => {
    const { getByTestId } = render(
      <AvatarCarouselItem
        avatar={avatar}
        avatarBtnRefs={avatarBtnRefs}
        index={index}
        isActive={isActive}
        onAvatarClick={onAvatarClick}
      />
    );

    const button = getByTestId(`avatar-carousel-item-${avatar.id}`);
    button.click();

    expect(onAvatarClick).toHaveBeenCalledWith(index);
  });

  it('sets isActive class when isActive is true', () => {
    const { getByTestId } = render(
      <AvatarCarouselItem
        isActive
        avatar={avatar}
        avatarBtnRefs={avatarBtnRefs}
        index={index}
        onAvatarClick={onAvatarClick}
      />
    );

    expect(getByTestId(`avatar-carousel-item-${avatar.id}`)).toHaveClass(
      'active'
    );
  });
});

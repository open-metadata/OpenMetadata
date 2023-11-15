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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { ReactionType } from '../../generated/type/reaction';
import Emoji from './Emoji';

const onReactionSelect = jest.fn();

jest.mock('../../hooks/useImage', () =>
  jest.fn().mockReturnValue({ image: null })
);

jest.mock('../../AppState', () => ({
  getCurrentUserDetails: jest.fn().mockReturnValue({
    id: '2e424734-761a-443f-bf2a-a5b361823c80',
    type: 'user',
    name: 'aaron_johnson0',
    fullyQualifiedName: 'aaron_johnson0',
    displayName: 'Aaron Johnson',
    deleted: false,
  }),
}));

const mockProps = {
  reaction: ReactionType.ThumbsUp,
  reactionList: [
    {
      reactionType: ReactionType.ThumbsUp,
      user: {
        id: '2e424734-761a-443f-bf2a-a5b361823c80',
        type: 'user',
        name: 'aaron_johnson0',
        fullyQualifiedName: 'aaron_johnson0',
        displayName: 'Aaron Johnson',
        deleted: false,
      },
    },
  ],
  onReactionSelect,
};

describe('Test Emoji Component', () => {
  it('Should render the component', async () => {
    const { findByTestId } = render(<Emoji {...mockProps} />);

    const emojiButton = await findByTestId('emoji-button');

    expect(emojiButton).toBeInTheDocument();

    const emoji = await findByTestId('emoji');

    expect(emoji).toBeInTheDocument();

    const emojiCount = await findByTestId('emoji-count');

    expect(emojiCount).toBeInTheDocument();

    expect(emojiCount).toHaveTextContent(`${mockProps.reactionList.length}`);
  });

  it('Should render the tooltip component on hovering the emoji', async () => {
    const { findByTestId } = render(<Emoji {...mockProps} />);

    const emojiButton = await findByTestId('emoji-button');

    expect(emojiButton).toBeInTheDocument();

    fireEvent.mouseEnter(emojiButton);

    const tooltip = await findByTestId('popover-content');

    expect(tooltip).toBeInTheDocument();

    expect(tooltip).toHaveTextContent(
      `${mockProps.reactionList[0].user.name} message.reacted-with-emoji`
    );
  });

  it('Should call onReaction select on click of emoji button', async () => {
    const { findByTestId } = render(<Emoji {...mockProps} />);

    const emojiButton = await findByTestId('emoji-button');

    expect(emojiButton).toBeInTheDocument();

    fireEvent.click(emojiButton);

    expect(onReactionSelect).toHaveBeenCalledWith(mockProps.reaction, 'remove');
  });
});

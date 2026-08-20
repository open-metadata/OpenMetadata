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

import { act, fireEvent, render } from '@testing-library/react';
import { User } from '../../../generated/entity/teams/user';
import { ReactionType } from '../../../generated/type/reaction';
import Emoji from './Emoji';

const onReactionSelect = jest.fn();
const mockUserData: User = {
  name: 'aaron_johnson0',
  email: 'testUser1@email.com',
  id: '2e424734-761a-443f-bf2a-a5b361823c80',
};

jest.mock('../../../hooks/useImage', () =>
  jest.fn().mockReturnValue({ image: null })
);

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
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
      `${mockProps.reactionList[0].user.displayName} message.reacted-with-emoji`
    );
  });

  it('Should call onReaction select on click of emoji button', async () => {
    const { findByTestId } = render(<Emoji {...mockProps} />);

    const emojiButton = await findByTestId('emoji-button');

    expect(emojiButton).toBeInTheDocument();

    fireEvent.click(emojiButton);

    expect(onReactionSelect).toHaveBeenCalledWith(mockProps.reaction, 'remove');
  });

  it('Should hide popover on mouse leave', async () => {
    const { findByTestId, queryByTestId } = render(<Emoji {...mockProps} />);

    const emojiButton = await findByTestId('emoji-button');
    fireEvent.mouseEnter(emojiButton);
    await findByTestId('popover-content');

    fireEvent.mouseLeave(emojiButton);
    act(() => jest.runAllTimers());

    expect(queryByTestId('popover-content')).not.toBeVisible();
  });

  it('Should unmount cleanly while tooltip is visible', async () => {
    const { findByTestId, unmount } = render(<Emoji {...mockProps} />);

    const emojiButton = await findByTestId('emoji-button');
    fireEvent.mouseEnter(emojiButton);
    await findByTestId('popover-content');

    // Simulate detached-node condition: real browsers return null from
    // getBoundingClientRect() on a node removed from the layout tree,
    // which is what caused "Cannot read properties of null (reading 'left')".
    // jsdom always returns a zero DOMRect, so we mock it explicitly.
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(null as unknown as DOMRect);

    expect(() => unmount()).not.toThrow();

    // Flush Ant Design's deferred repositioning callbacks to ensure nothing
    // throws after the trigger node is removed from the DOM.
    expect(() => act(() => jest.runAllTimers())).not.toThrow();
  });
});

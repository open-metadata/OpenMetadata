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
import userEvent from '@testing-library/user-event';
import { ReactionsVariant } from '../../../enums/reactions.enum';
import { ReactionType } from '../../../generated/type/reaction';
import Reactions from './Reactions';

const onReactionSelect = jest.fn();
const REACTOR_ID = '2e424734-761a-443f-bf2a-a5b361823c80';
let mockCurrentUserId = 'viewer';

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: mockCurrentUserId } }),
}));

const reactions = [
  {
    reactionType: ReactionType.Heart,
    user: {
      id: '2e424734-761a-443f-bf2a-a5b361823c80',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  },
  {
    reactionType: ReactionType.Confused,
    user: {
      id: '2e424734-761a-443f-bf2a-a5b361823c80',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  },
  {
    reactionType: ReactionType.Laugh,
    user: {
      id: '2e424734-761a-443f-bf2a-a5b361823c80',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  },
  {
    reactionType: ReactionType.ThumbsDown,
    user: {
      id: '2e424734-761a-443f-bf2a-a5b361823c80',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  },
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
  {
    reactionType: ReactionType.Hooray,
    user: {
      id: '2e424734-761a-443f-bf2a-a5b361823c80',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  },
  {
    reactionType: ReactionType.Rocket,
    user: {
      id: '2e424734-761a-443f-bf2a-a5b361823c80',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  },
  {
    reactionType: ReactionType.Eyes,
    user: {
      id: '2e424734-761a-443f-bf2a-a5b361823c80',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  },
];

const mockProps = {
  reactions,
  onReactionSelect,
};

describe('Text Reactions component', () => {
  beforeEach(() => {
    mockCurrentUserId = 'viewer';
    onReactionSelect.mockClear();
  });

  it('drops the pills tray once the viewer has picked every reaction', () => {
    mockCurrentUserId = REACTOR_ID;
    const { queryByTestId } = render(
      <Reactions {...mockProps} variant={ReactionsVariant.Pill} />
    );

    expect(queryByTestId('add-reactions')).not.toBeInTheDocument();
  });

  it('keeps the classic tray, to take a reaction back', () => {
    mockCurrentUserId = REACTOR_ID;
    const { getByTestId } = render(<Reactions {...mockProps} />);

    expect(getByTestId('add-reactions')).toBeInTheDocument();
  });

  // The Inbox shows the thumbs up as its Like, outside the pills.
  it('marks a reaction picked outside the pills, and takes it back', async () => {
    const { findByTestId, getByRole, queryAllByTestId } = render(
      <Reactions
        pickedReactions={[
          { ...reactions[4], user: { id: 'viewer', type: 'user' } },
        ]}
        reactions={[]}
        onReactionSelect={onReactionSelect}
      />
    );

    expect(queryAllByTestId('emoji')).toHaveLength(0);

    fireEvent.click(await findByTestId('add-reactions'));
    const thumbsUp = getByRole('button', { name: ReactionType.ThumbsUp });

    expect(thumbsUp).toHaveClass('tw:bg-brand-primary');

    fireEvent.click(thumbsUp);

    expect(onReactionSelect).toHaveBeenCalledWith(
      ReactionType.ThumbsUp,
      'remove'
    );
  });

  it('should render component', async () => {
    const { findByTestId, findAllByTestId } = render(
      <Reactions {...mockProps} />
    );

    const addReationButton = await findByTestId('add-reactions');

    expect(addReationButton).toBeInTheDocument();

    const reactedEmojis = await findAllByTestId('emoji');

    expect(reactedEmojis).toHaveLength(reactions.length);
  });

  it('should render component popover on click of add reactions button', async () => {
    const { findByTestId, findAllByTestId } = render(
      <Reactions {...mockProps} />
    );

    const addReationButton = await findByTestId('add-reactions');

    expect(addReationButton).toBeInTheDocument();

    fireEvent.click(addReationButton);

    const reactionList = await findAllByTestId('reaction-button');

    expect(reactionList).toHaveLength(8);
  });

  it('keeps a focused reaction operable when the feed re-renders', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { getByTestId, findByRole, rerender } = render(
      <Reactions {...mockProps} />
    );
    await user.click(getByTestId('add-reactions'));
    const reaction = await findByRole('button', { name: 'hooray' });
    reaction.focus();

    rerender(<Reactions {...mockProps} reactions={[...reactions]} />);

    expect(reaction).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(onReactionSelect).toHaveBeenCalledWith(ReactionType.Hooray, 'add');
  });
});

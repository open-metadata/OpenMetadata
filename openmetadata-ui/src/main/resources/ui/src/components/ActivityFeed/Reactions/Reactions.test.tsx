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
import { ReactionType } from '../../../generated/type/reaction';
import Reactions from './Reactions';

jest.mock('./Emoji', () =>
  jest.fn().mockReturnValue(<button data-testid="emoji">Emoji</button>)
);

jest.mock('./Reaction', () =>
  jest.fn().mockReturnValue(<button data-testid="reaction">Reaction</button>)
);

const onReactionSelect = jest.fn();

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

    const reactionList = await findAllByTestId('reaction');

    expect(reactionList).toHaveLength(8);
  });
});

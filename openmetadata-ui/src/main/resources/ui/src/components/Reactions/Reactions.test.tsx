/*
 *  Copyright 2021 Collate
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
import Reactions from './Reactions';

jest.mock('./Emoji', () =>
  jest.fn().mockReturnValue(<button data-testid="emoji">Emoji</button>)
);

jest.mock('./Reaction', () =>
  jest.fn().mockReturnValue(<button data-testid="reaction">Reaction</button>)
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

const onReactionSelect = jest.fn();

const reactions = [
  {
    reactionType: 'heart',
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
    reactionType: 'confused',
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
    reactionType: 'laugh',
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
    reactionType: 'thumbsDown',
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
    reactionType: 'thumbsUp',
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
    reactionType: 'hooray',
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
    reactionType: 'rocket',
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
    reactionType: 'eyes',
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

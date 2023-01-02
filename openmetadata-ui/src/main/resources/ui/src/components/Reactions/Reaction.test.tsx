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
import Reaction from './Reaction';

const onReactionSelect = jest.fn();
const onHide = jest.fn();

jest.mock('../../hooks/useImage', () =>
  jest.fn().mockReturnValue({ image: null })
);

const mockProps = {
  reaction: { emoji: '👍', reaction: ReactionType.ThumbsUp, alias: '+1' },
  isReacted: false,
  onReactionSelect,
  onHide,
};

describe('Test Reaction Component', () => {
  it('Should render the component', async () => {
    const { findByTestId } = render(<Reaction {...mockProps} />);

    const reactionButton = await findByTestId('reaction-button');

    expect(reactionButton).toBeInTheDocument();

    const emoji = await findByTestId('emoji');

    expect(emoji).toBeInTheDocument();
  });

  it('Should call onReaction select on click of emoji button', async () => {
    const { findByTestId } = render(<Reaction {...mockProps} />);

    const reactionButton = await findByTestId('reaction-button');

    expect(reactionButton).toBeInTheDocument();

    fireEvent.click(reactionButton);

    expect(onReactionSelect).toHaveBeenCalledWith(
      mockProps.reaction.reaction,
      'add'
    );
  });

  it('Should call onHide methdod on click of emoji button', async () => {
    const { findByTestId } = render(<Reaction {...mockProps} />);

    const reactionButton = await findByTestId('reaction-button');

    expect(reactionButton).toBeInTheDocument();

    fireEvent.click(reactionButton);

    expect(onHide).toHaveBeenCalled();
  });
});

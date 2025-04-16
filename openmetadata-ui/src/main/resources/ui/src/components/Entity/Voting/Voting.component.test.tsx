/*
 *  Copyright 2023 Collate.
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
import { QueryVoteType } from '../../Database/TableQueries/TableQueries.interface';
import Voting from './Voting.component';
import { VotingProps } from './voting.interface';

const mockOnUpdateVote = jest.fn();

const mockProps: VotingProps = {
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
  disabled: false,
  voteStatus: QueryVoteType.unVoted,
  onUpdateVote: mockOnUpdateVote,
};

describe('Voting component test', () => {
  it('voting component should render', async () => {
    render(<Voting {...mockProps} />);

    expect(await screen.findByTestId('up-vote-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('down-vote-btn')).toBeInTheDocument();

    expect(await screen.findByTestId('up-vote-count')).toHaveTextContent('0');
    expect(await screen.findByTestId('down-vote-count')).toHaveTextContent('0');
  });

  it('voting component should render count based on data', async () => {
    render(
      <Voting
        {...mockProps}
        votes={{ ...mockProps.votes, upVotes: 3, downVotes: 5 }}
      />
    );

    expect(await screen.findByTestId('up-vote-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('down-vote-btn')).toBeInTheDocument();

    expect(await screen.findByTestId('up-vote-count')).toHaveTextContent('3');
    expect(await screen.findByTestId('down-vote-count')).toHaveTextContent('5');
  });

  it('update handler should call with up voting', async () => {
    render(<Voting {...mockProps} />);

    const upVoteButton = await screen.findByTestId('up-vote-btn');

    expect(upVoteButton).toBeInTheDocument();

    fireEvent.click(upVoteButton);

    expect(mockOnUpdateVote).toHaveBeenCalledWith({
      updatedVoteType: QueryVoteType.votedUp,
    });
  });

  it('update handler should call with down voting', async () => {
    render(<Voting {...mockProps} />);

    const downButton = await screen.findByTestId('down-vote-btn');

    expect(downButton).toBeInTheDocument();

    fireEvent.click(downButton);

    expect(mockOnUpdateVote).toHaveBeenCalledWith({
      updatedVoteType: QueryVoteType.votedDown,
    });
  });

  it('update handler should call with un-voted when already selected of up-voted', async () => {
    render(<Voting {...mockProps} voteStatus={QueryVoteType.votedUp} />);

    const upVoteButton = await screen.findByTestId('up-vote-btn');

    expect(upVoteButton).toBeInTheDocument();

    fireEvent.click(upVoteButton);

    expect(mockOnUpdateVote).toHaveBeenCalledWith({
      updatedVoteType: QueryVoteType.unVoted,
    });
  });

  it('update handler should call with un-voted when already selected of down-voted', async () => {
    render(<Voting {...mockProps} voteStatus={QueryVoteType.votedDown} />);

    const downVoteButton = await screen.findByTestId('down-vote-btn');

    expect(downVoteButton).toBeInTheDocument();

    fireEvent.click(downVoteButton);

    expect(mockOnUpdateVote).toHaveBeenCalledWith({
      updatedVoteType: QueryVoteType.unVoted,
    });
  });

  it('voting button should be disabled as per props', async () => {
    render(<Voting {...mockProps} disabled />);

    expect(await screen.findByTestId('up-vote-btn')).toBeDisabled();
    expect(await screen.findByTestId('down-vote-btn')).toBeDisabled();
  });
});

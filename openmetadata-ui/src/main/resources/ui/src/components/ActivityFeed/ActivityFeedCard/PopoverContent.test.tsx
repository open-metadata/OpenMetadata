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

import { fireEvent, render, screen } from '@testing-library/react';
import { User } from '../../../generated/entity/teams/user';
import PopoverContent from './PopoverContent';

const onConfirmation = jest.fn();
const onEdit = jest.fn();
const onPopoverHide = jest.fn();
const onReactionSelect = jest.fn();
const onReply = jest.fn();

const mockProps = {
  isAnnouncement: false,
  isAuthor: true,
  isThread: false,
  editAnnouncementPermission: true,
  onConfirmation,
  onEdit,
  onPopoverHide,
  onReactionSelect,
  onReply,
  postId: '3d6bb831-fbe4-484e-ba54-1bd7568ddc59',
  reactions: [],
  threadId: '3d6bb831-fbe4-484e-ba54-1bd7568ddc59',
};
const mockUserData: User = {
  name: 'aaron_johnson0',
  email: 'testUser1@email.com',
  id: '011bdb24-90a7-4a97-ba66-24002adb2b12',
  isAdmin: true,
};

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('../../../constants/reactions.constant', () => ({
  REACTION_LIST: [
    { emoji: '👍', reaction: 'thumbsUp', alias: '+1' },
    { emoji: '👎', reaction: 'thumbsDown', alias: '-1' },
    { emoji: '😄', reaction: 'laugh', alias: 'smile' },
    { emoji: '🎉', reaction: 'hooray', alias: 'tada' },
    { emoji: '😕', reaction: 'confused', alias: 'thinking_face' },
    { emoji: '❤️', reaction: 'heart', alias: 'heart' },
    { emoji: '👀', reaction: 'eyes', alias: 'rocket' },
    { emoji: '🚀', reaction: 'rocket', alias: 'eyes' },
  ],
}));

jest.mock('../Reactions/Reaction', () => {
  return jest.fn().mockReturnValue(<div data-testid="reaction">Reaction</div>);
});

describe('Test Popover content component', () => {
  it('Should render the component', async () => {
    render(<PopoverContent {...mockProps} />);
    const reactionButton = await screen.findByTestId('add-reactions');

    const replyButton = await screen.findByTestId('add-reply');

    const editButton = await screen.findByTestId('edit-message');

    const deleteButton = await screen.findByTestId('delete-message');

    expect(reactionButton).toBeInTheDocument();
    expect(replyButton).toBeInTheDocument();
    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it('Should not render the reply button if onReply is undefined', async () => {
    render(<PopoverContent {...mockProps} onReply={undefined} />);

    const replyButton = screen.queryByTestId('add-reply');

    expect(replyButton).toBeNull();
  });

  it('Should render reaction popover on click of reaction button', async () => {
    render(<PopoverContent {...mockProps} />);

    const reactionButton = await screen.findByTestId('add-reactions');

    expect(reactionButton).toBeInTheDocument();

    fireEvent.click(reactionButton);

    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    // should render all available reactions
    expect(await screen.findAllByTestId('reaction')).toHaveLength(8);
  });

  it('Should call onReply function on click of reply button', async () => {
    render(<PopoverContent {...mockProps} />);

    const replyButton = await screen.findByTestId('add-reply');

    expect(replyButton).toBeInTheDocument();

    fireEvent.click(replyButton);

    expect(onReply).toHaveBeenCalled();
  });

  it('Should call onEdit function on click of edit button', async () => {
    render(<PopoverContent {...mockProps} />);

    const editButton = await screen.findByTestId('edit-message');

    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalled();
  });

  it('Should call onConfirmation function on click of delete button', async () => {
    render(<PopoverContent {...mockProps} />);

    const deleteButton = await screen.findByTestId('delete-message');

    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);

    expect(onConfirmation).toHaveBeenCalled();
  });

  it('Announcement should be editable by admin user', async () => {
    render(<PopoverContent {...mockProps} isAnnouncement isAuthor={false} />);

    const editButton = await screen.findByTestId('edit-message');

    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalled();
  });

  it('Announcement should be delete by admin user', async () => {
    render(<PopoverContent {...mockProps} isAnnouncement isAuthor={false} />);

    const deleteButton = await screen.findByTestId('delete-message');

    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);

    expect(onConfirmation).toHaveBeenCalled();
  });
});

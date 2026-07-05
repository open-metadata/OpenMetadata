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

import { fireEvent, render, screen } from '@testing-library/react';
import { McpConversation } from '../../rest/mcpClientAPI';
import ChatList from './ChatList';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: ({ size }: { size?: string }) => (
    <div data-testid={`loader-${size ?? 'default'}`} />
  ),
}));

jest.mock('../../components/common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({
    open,
    onCancel,
    onDelete,
    entityTitle,
  }: {
    open: boolean;
    onCancel: () => void;
    onDelete: () => void;
    entityTitle: string;
  }) =>
    open ? (
      <div data-testid="delete-modal">
        <span>{entityTitle}</span>
        <button data-testid="cancel-button" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="confirm-button" onClick={onDelete}>
          Confirm
        </button>
      </div>
    ) : null,
}));

jest.mock('@untitledui/icons', () => ({
  Trash01: () => <svg data-testid="trash-icon" />,
}));

const makeConversation = (id: string, title?: string): McpConversation => ({
  id,
  user: { id: 'user-1', name: 'admin', type: 'user' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messageCount: 0,
  title,
});

const defaultProps = {
  conversations: [],
  activeConversationId: undefined,
  isLoading: false,
  isLoadingMore: false,
  onSelect: jest.fn(),
  onDelete: jest.fn(),
  onLoadMore: jest.fn(),
};

describe('ChatList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loader when isLoading is true', () => {
    render(<ChatList {...defaultProps} isLoading />);

    expect(screen.getByTestId('loader-small')).toBeInTheDocument();
  });

  it('renders conversation titles', () => {
    const conversations = [
      makeConversation('c1', 'First Chat'),
      makeConversation('c2', 'Second Chat'),
    ];
    render(<ChatList {...defaultProps} conversations={conversations} />);

    expect(screen.getByText('First Chat')).toBeInTheDocument();
    expect(screen.getByText('Second Chat')).toBeInTheDocument();
  });

  it('renders fallback title when conversation has no title', () => {
    const conversations = [makeConversation('abc12345')];
    render(<ChatList {...defaultProps} conversations={conversations} />);

    expect(screen.getByText('label.conversation abc12345')).toBeInTheDocument();
  });

  it('renders "Recent Chat" header when conversations exist', () => {
    const conversations = [makeConversation('c1', 'Chat')];
    render(<ChatList {...defaultProps} conversations={conversations} />);

    expect(screen.getByText('label.recent-chat')).toBeInTheDocument();
  });

  it('does not render "Recent Chat" header when conversations list is empty', () => {
    render(<ChatList {...defaultProps} conversations={[]} />);

    expect(screen.queryByText('label.recent-chat')).not.toBeInTheDocument();
  });

  it('calls onSelect when conversation item is clicked', () => {
    const onSelect = jest.fn();
    const conversations = [makeConversation('c1', 'Chat One')];
    render(
      <ChatList
        {...defaultProps}
        conversations={conversations}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText('Chat One').closest('button')!);

    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('opens delete modal when delete button is clicked', () => {
    const conversations = [makeConversation('c1', 'Chat One')];
    render(<ChatList {...defaultProps} conversations={conversations} />);

    fireEvent.click(screen.getByTestId('delete-conversation-c1'));

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('closes delete modal when cancel is clicked', () => {
    const conversations = [makeConversation('c1', 'Chat One')];
    render(<ChatList {...defaultProps} conversations={conversations} />);

    fireEvent.click(screen.getByTestId('delete-conversation-c1'));
    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });

  it('calls onDelete and closes modal when confirm is clicked', () => {
    const onDelete = jest.fn();
    const conversations = [makeConversation('c1', 'Chat One')];
    render(
      <ChatList
        {...defaultProps}
        conversations={conversations}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByTestId('delete-conversation-c1'));
    fireEvent.click(screen.getByTestId('confirm-button'));

    expect(onDelete).toHaveBeenCalledWith('c1');
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });

  it('delete button click does not trigger onSelect', () => {
    const onSelect = jest.fn();
    const conversations = [makeConversation('c1', 'Chat One')];
    render(
      <ChatList
        {...defaultProps}
        conversations={conversations}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByTestId('delete-conversation-c1'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows loading-more indicator when isLoadingMore is true', () => {
    const conversations = [makeConversation('c1', 'Chat')];
    render(
      <ChatList {...defaultProps} isLoadingMore conversations={conversations} />
    );

    expect(screen.getByTestId('loader-small')).toBeInTheDocument();
  });

  it('uses conversation title in delete modal', () => {
    const conversations = [makeConversation('c1', 'Important Chat')];
    render(<ChatList {...defaultProps} conversations={conversations} />);

    fireEvent.click(screen.getByTestId('delete-conversation-c1'));

    expect(screen.getAllByText('Important Chat')).toHaveLength(2);
  });
});

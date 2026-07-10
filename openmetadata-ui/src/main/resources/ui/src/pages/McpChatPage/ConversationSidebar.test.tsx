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
import React from 'react';
import { McpConversation } from '../../rest/mcpClientAPI';
import ConversationSidebar from './ConversationSidebar';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Typography: ({
    children,
    className,
    weight,
  }: {
    children: React.ReactNode;
    className?: string;
    weight?: string;
  }) => (
    <span className={className} data-weight={weight}>
      {children}
    </span>
  ),
}));

jest.mock('@untitledui/icons', () => ({
  Plus: () => <svg data-testid="plus-icon" />,
}));

jest.mock('./ChatList', () => ({
  __esModule: true,
  default: ({
    conversations,
    activeConversationId,
    onSelect,
    onDelete,
  }: {
    conversations: McpConversation[];
    activeConversationId?: string;
    isLoading: boolean;
    isLoadingMore: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <div data-testid="chat-list">
      {conversations.map((c) => (
        <div key={c.id}>
          <button data-testid={`select-${c.id}`} onClick={() => onSelect(c.id)}>
            {c.title ?? c.id}
          </button>
          <button data-testid={`delete-${c.id}`} onClick={() => onDelete(c.id)}>
            Delete
          </button>
        </div>
      ))}
      {activeConversationId && (
        <span data-testid="active-id">{activeConversationId}</span>
      )}
    </div>
  ),
}));

jest.mock('./NavItem', () => ({
  __esModule: true,
  default: ({
    label,
    onClick,
    dataTestId,
  }: {
    label: string;
    onClick: () => void;
    dataTestId?: string;
    icon: unknown;
  }) => (
    <button data-testid={dataTestId} onClick={onClick}>
      {label}
    </button>
  ),
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
  onSelect: jest.fn(),
  onNewChat: jest.fn(),
  onDelete: jest.fn(),
};

describe('ConversationSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the sidebar test ID', () => {
    render(<ConversationSidebar {...defaultProps} />);

    expect(screen.getByTestId('mcp-conversation-sidebar')).toBeInTheDocument();
  });

  it('renders the MCP Chat header', () => {
    render(<ConversationSidebar {...defaultProps} />);

    expect(screen.getByText('label.mcp-chat')).toBeInTheDocument();
  });

  it('renders the new chat button', () => {
    render(<ConversationSidebar {...defaultProps} />);

    expect(screen.getByTestId('new-chat-button')).toBeInTheDocument();
    expect(screen.getByText('label.new-chat')).toBeInTheDocument();
  });

  it('calls onNewChat when new chat button is clicked', () => {
    const onNewChat = jest.fn();
    render(<ConversationSidebar {...defaultProps} onNewChat={onNewChat} />);

    fireEvent.click(screen.getByTestId('new-chat-button'));

    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('renders ChatList with conversations', () => {
    const conversations = [makeConversation('c1', 'First')];
    render(
      <ConversationSidebar {...defaultProps} conversations={conversations} />
    );

    expect(screen.getByTestId('chat-list')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
  });

  it('passes activeConversationId to ChatList', () => {
    const conversations = [makeConversation('c1', 'First')];
    render(
      <ConversationSidebar
        {...defaultProps}
        activeConversationId="c1"
        conversations={conversations}
      />
    );

    expect(screen.getByTestId('active-id')).toHaveTextContent('c1');
  });

  it('calls onSelect when ChatList triggers select', () => {
    const onSelect = jest.fn();
    const conversations = [makeConversation('c1', 'Chat One')];
    render(
      <ConversationSidebar
        {...defaultProps}
        conversations={conversations}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByTestId('select-c1'));

    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('calls onDelete when ChatList triggers delete', () => {
    const onDelete = jest.fn();
    const conversations = [makeConversation('c1', 'Chat One')];
    render(
      <ConversationSidebar
        {...defaultProps}
        conversations={conversations}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByTestId('delete-c1'));

    expect(onDelete).toHaveBeenCalledWith('c1');
  });
});

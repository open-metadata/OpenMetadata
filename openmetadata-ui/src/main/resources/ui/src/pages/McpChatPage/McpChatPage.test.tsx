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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  deleteConversation,
  listConversations,
  listMessages,
  McpConversation,
  McpMessage,
  streamChatMessage,
} from '../../rest/mcpClientAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import McpChatPage from './McpChatPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../rest/mcpClientAPI', () => ({
  listConversations: jest.fn(),
  listMessages: jest.fn(),
  deleteConversation: jest.fn(),
  streamChatMessage: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./ConversationSidebar', () => ({
  __esModule: true,
  default: ({
    conversations,
    activeConversationId,
    isLoading,
    onSelect,
    onNewChat,
    onDelete,
  }: {
    conversations: McpConversation[];
    activeConversationId?: string;
    isLoading: boolean;
    onSelect: (id: string) => void;
    onNewChat: () => void;
    onDelete: (id: string) => void;
  }) => (
    <div data-testid="conversation-sidebar">
      <button data-testid="new-chat" onClick={onNewChat}>
        New Chat
      </button>
      {isLoading && <span data-testid="sidebar-loading" />}
      {conversations.map((c) => (
        <div key={c.id}>
          <button
            data-testid={`select-conv-${c.id}`}
            onClick={() => onSelect(c.id)}>
            {c.title ?? c.id}
          </button>
          <button
            data-testid={`delete-conv-${c.id}`}
            onClick={() => onDelete(c.id)}>
            Delete
          </button>
        </div>
      ))}
      {activeConversationId && (
        <span data-testid="active-conv">{activeConversationId}</span>
      )}
    </div>
  ),
}));

jest.mock('./MessageList', () => ({
  __esModule: true,
  default: ({
    messages,
    isLoading,
  }: {
    messages: McpMessage[];
    isLoading: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    endRef: React.RefObject<HTMLDivElement | null>;
  }) => (
    <div data-testid="message-list">
      {isLoading && <span data-testid="messages-loading" />}
      {messages.map((m) => (
        <div data-testid={`message-${m.id}`} key={m.id}>
          {m.content?.[0]?.textMessage?.message ?? ''}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./ChatInput', () => ({
  __esModule: true,
  default: ({
    isSending,
    onSendMessage,
    onStop,
  }: {
    isSending: boolean;
    onSendMessage: (msg: string) => void;
    onStop: () => void;
  }) => (
    <div data-testid="chat-input">
      <input
        data-testid="message-input"
        type="text"
        onChange={() => undefined}
      />
      <button
        data-testid="send-btn"
        onClick={() => onSendMessage('test message')}>
        Send
      </button>
      {isSending && (
        <button data-testid="stop-btn" onClick={onStop}>
          Stop
        </button>
      )}
    </div>
  ),
}));

const mockListConversations = listConversations as jest.MockedFunction<
  typeof listConversations
>;
const mockListMessages = listMessages as jest.MockedFunction<
  typeof listMessages
>;
const mockDeleteConversation = deleteConversation as jest.MockedFunction<
  typeof deleteConversation
>;
const mockStreamChatMessage = streamChatMessage as jest.MockedFunction<
  typeof streamChatMessage
>;
const mockShowErrorToast = showErrorToast as jest.MockedFunction<
  typeof showErrorToast
>;

const makeConversation = (id: string, title?: string): McpConversation => ({
  id,
  user: { id: 'u1', name: 'admin', type: 'user' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messageCount: 0,
  title,
});

const makeMessage = (
  id: string,
  sender: 'human' | 'assistant' = 'human',
  text = 'hello'
): McpMessage => ({
  id,
  conversationId: 'conv-1',
  sender,
  index: 0,
  timestamp: Date.now(),
  content: [{ type: 'Generic', textMessage: { type: 'plain', message: text } }],
});

const renderPage = (initialPath = '/mcp-chat') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<McpChatPage />} path="/mcp-chat" />
        <Route element={<McpChatPage />} path="/mcp-chat/:id" />
      </Routes>
    </MemoryRouter>
  );

describe('McpChatPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListConversations.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockStreamChatMessage.mockResolvedValue(undefined);
  });

  it('renders sidebar and empty state on initial load', async () => {
    await act(async () => {
      renderPage();
    });

    expect(screen.getByTestId('conversation-sidebar')).toBeInTheDocument();
    expect(screen.getByText('message.mcp-chat-empty')).toBeInTheDocument();
  });

  it('fetches conversations on mount', async () => {
    mockListConversations.mockResolvedValue({
      data: [makeConversation('c1', 'Conv One')],
      paging: { total: 1 },
    });

    await act(async () => {
      renderPage();
    });

    expect(mockListConversations).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Conv One')).toBeInTheDocument();
  });

  it('shows error toast when fetching conversations fails', async () => {
    const error = new Error('Network error');
    mockListConversations.mockRejectedValue(error);

    await act(async () => {
      renderPage();
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(error);
  });

  it('fetches messages when conversationId is in URL', async () => {
    mockListMessages.mockResolvedValue({
      data: [makeMessage('m1', 'human', 'Hello')],
    });
    mockListConversations.mockResolvedValue({
      data: [makeConversation('conv-1')],
      paging: { total: 1 },
    });

    await act(async () => {
      renderPage('/mcp-chat/conv-1');
    });

    expect(mockListMessages).toHaveBeenCalledWith('conv-1');
    expect(screen.getByTestId('message-m1')).toBeInTheDocument();
  });

  it('shows error toast when fetching messages fails', async () => {
    const error = new Error('Failed to load');
    mockListMessages.mockRejectedValue(error);

    await act(async () => {
      renderPage('/mcp-chat/conv-1');
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(error);
  });

  it('navigates to /mcp-chat when New Chat is clicked', async () => {
    await act(async () => {
      renderPage('/mcp-chat/conv-1');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('new-chat'));
    });

    expect(screen.queryByTestId('active-conv')).not.toBeInTheDocument();
  });

  it('shows MessageList and ChatInput when a conversation is active', async () => {
    mockListConversations.mockResolvedValue({
      data: [makeConversation('c1', 'Active Chat')],
      paging: { total: 1 },
    });
    mockListMessages.mockResolvedValue({ data: [] });

    await act(async () => {
      renderPage('/mcp-chat/c1');
    });

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('calls deleteConversation when onDelete is triggered from sidebar', async () => {
    mockDeleteConversation.mockResolvedValue(undefined);
    mockListConversations.mockResolvedValue({
      data: [makeConversation('c1', 'Chat To Delete')],
      paging: { total: 1 },
    });

    await act(async () => {
      renderPage();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-conv-c1'));
    });

    expect(mockDeleteConversation).toHaveBeenCalledWith('c1');
  });

  it('removes deleted conversation from the list', async () => {
    mockDeleteConversation.mockResolvedValue(undefined);
    mockListConversations.mockResolvedValue({
      data: [makeConversation('c1', 'Deleted Chat')],
      paging: { total: 1 },
    });

    await act(async () => {
      renderPage();
    });

    expect(screen.getByText('Deleted Chat')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-conv-c1'));
    });

    expect(screen.queryByText('Deleted Chat')).not.toBeInTheDocument();
  });

  it('shows error toast when deleteConversation fails', async () => {
    const error = new Error('Delete failed');
    mockDeleteConversation.mockRejectedValue(error);
    mockListConversations.mockResolvedValue({
      data: [makeConversation('c1', 'Chat')],
      paging: { total: 1 },
    });

    await act(async () => {
      renderPage();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-conv-c1'));
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(error);
  });

  it('sends message via streamChatMessage when send button is clicked', async () => {
    await act(async () => {
      renderPage('/mcp-chat/conv-1');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('send-btn'));
    });

    await waitFor(() => {
      expect(mockStreamChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'test message' }),
        expect.any(Object),
        expect.any(AbortSignal)
      );
    });
  });

  it('stops streaming when stop button is clicked', async () => {
    let resolveStream: () => void;
    mockStreamChatMessage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStream = resolve;
        })
    );

    await act(async () => {
      renderPage('/mcp-chat/conv-1');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('send-btn'));
    });

    expect(screen.getByTestId('stop-btn')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('stop-btn'));
    });

    expect(screen.queryByTestId('stop-btn')).not.toBeInTheDocument();

    resolveStream!();
  });

  it('renders ChatInput in centered layout when no active conversation and no messages', async () => {
    await act(async () => {
      renderPage();
    });

    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
  });

  it('updates active conversation when selecting from sidebar', async () => {
    mockListConversations.mockResolvedValue({
      data: [
        makeConversation('c1', 'Chat One'),
        makeConversation('c2', 'Chat Two'),
      ],
      paging: { total: 2 },
    });
    mockListMessages.mockResolvedValue({ data: [] });

    await act(async () => {
      renderPage();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-conv-c2'));
    });

    expect(screen.getByTestId('active-conv')).toHaveTextContent('c2');
  });
});

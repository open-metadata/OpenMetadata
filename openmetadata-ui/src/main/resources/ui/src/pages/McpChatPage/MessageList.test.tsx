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

import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { McpMessage } from '../../rest/mcpClientAPI';
import MessageList from './MessageList';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('./MessageBubble', () => ({
  __esModule: true,
  default: ({ message }: { message: McpMessage }) => (
    <div data-testid={`bubble-${message.id}`}>{message.id}</div>
  ),
}));

const makeMessage = (id: string): McpMessage => ({
  id,
  conversationId: 'conv-1',
  sender: 'human',
  index: 0,
  timestamp: Date.now(),
  content: [
    { type: 'Generic', textMessage: { type: 'plain', message: `msg ${id}` } },
  ],
});

describe('MessageList', () => {
  const containerRef = createRef<HTMLDivElement | null>();
  const endRef = createRef<HTMLDivElement | null>();

  it('shows loader when isLoading is true', () => {
    render(
      <MessageList
        isLoading
        containerRef={containerRef}
        endRef={endRef}
        messages={[]}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('shows empty state message when messages is empty and not loading', () => {
    render(
      <MessageList
        containerRef={containerRef}
        endRef={endRef}
        isLoading={false}
        messages={[]}
      />
    );

    expect(screen.getByText('message.mcp-chat-empty')).toBeInTheDocument();
  });

  it('renders a bubble for each message', () => {
    const messages = [makeMessage('a'), makeMessage('b'), makeMessage('c')];
    render(
      <MessageList
        containerRef={containerRef}
        endRef={endRef}
        isLoading={false}
        messages={messages}
      />
    );

    expect(screen.getByTestId('bubble-a')).toBeInTheDocument();
    expect(screen.getByTestId('bubble-b')).toBeInTheDocument();
    expect(screen.getByTestId('bubble-c')).toBeInTheDocument();
  });

  it('does not show empty state when messages are present', () => {
    const messages = [makeMessage('x')];
    render(
      <MessageList
        containerRef={containerRef}
        endRef={endRef}
        isLoading={false}
        messages={messages}
      />
    );

    expect(
      screen.queryByText('message.mcp-chat-empty')
    ).not.toBeInTheDocument();
  });

  it('does not show messages while loading', () => {
    const messages = [makeMessage('y')];
    render(
      <MessageList
        isLoading
        containerRef={containerRef}
        endRef={endRef}
        messages={messages}
      />
    );

    expect(screen.queryByTestId('bubble-y')).not.toBeInTheDocument();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });
});

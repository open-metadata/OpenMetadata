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
import { McpMessage } from '../../rest/mcpClientAPI';
import MessageBubble from './MessageBubble';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./MessageBubble.less', () => ({}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => (
    <div data-testid="react-markdown">{children}</div>
  ),
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: ({ size }: { size?: string }) => (
    <div data-testid={`loader-${size ?? 'default'}`} />
  ),
}));

const humanMessage: McpMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  sender: 'human',
  index: 0,
  timestamp: Date.now(),
  content: [
    { type: 'Generic', textMessage: { type: 'plain', message: 'Hello there' } },
  ],
};

const assistantMessage: McpMessage = {
  id: 'msg-2',
  conversationId: 'conv-1',
  sender: 'assistant',
  index: 1,
  timestamp: Date.now(),
  content: [
    {
      type: 'Generic',
      textMessage: { type: 'markdown', message: '**Bold reply**' },
    },
  ],
};

describe('MessageBubble', () => {
  it('renders human message text', () => {
    render(<MessageBubble message={humanMessage} />);

    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('renders assistant markdown message via ReactMarkdown', () => {
    render(<MessageBubble message={assistantMessage} />);

    expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
    expect(screen.getByText('**Bold reply**')).toBeInTheDocument();
  });

  it('renders plain text for human messages (not markdown)', () => {
    render(<MessageBubble message={humanMessage} />);

    expect(screen.queryByTestId('react-markdown')).not.toBeInTheDocument();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('shows thinking loader when assistant message has no content', () => {
    const thinkingMessage: McpMessage = {
      id: 'msg-3',
      conversationId: 'conv-1',
      sender: 'assistant',
      index: 2,
      timestamp: Date.now(),
      content: [],
    };
    render(<MessageBubble message={thinkingMessage} />);

    expect(screen.getByTestId('loader-x-small')).toBeInTheDocument();
    expect(screen.getByText('label.thinking')).toBeInTheDocument();
  });

  it('renders token count when tokens are provided', () => {
    const messageWithTokens: McpMessage = {
      ...assistantMessage,
      tokens: { totalTokens: 42 },
    };
    render(<MessageBubble message={messageWithTokens} />);

    expect(screen.getByText('42 label.token-plural')).toBeInTheDocument();
  });

  it('does not render token span when totalTokens is 0', () => {
    const messageWithZeroTokens: McpMessage = {
      ...assistantMessage,
      tokens: { totalTokens: 0 },
    };
    render(<MessageBubble message={messageWithZeroTokens} />);

    expect(screen.queryByText(/label\.token-plural/)).not.toBeInTheDocument();
  });

  it('renders tool call display for messages with tool blocks', () => {
    const messageWithTools: McpMessage = {
      id: 'msg-4',
      conversationId: 'conv-1',
      sender: 'assistant',
      index: 3,
      timestamp: Date.now(),
      content: [
        {
          type: 'Generic',
          tools: [{ name: 'get_table', input: { table: 'users' } }],
        },
      ],
    };
    render(<MessageBubble message={messageWithTools} />);

    expect(screen.getByText('get_table')).toBeInTheDocument();
  });

  it('expands tool call when chevron button is clicked', () => {
    const messageWithTools: McpMessage = {
      id: 'msg-5',
      conversationId: 'conv-1',
      sender: 'assistant',
      index: 4,
      timestamp: Date.now(),
      content: [
        {
          type: 'Generic',
          tools: [
            {
              name: 'search_entities',
              input: { query: 'table' },
              result: { count: 3 },
            },
          ],
        },
      ],
    };
    render(<MessageBubble message={messageWithTools} />);

    expect(screen.queryByText('label.input')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('search_entities').closest('button')!);

    expect(screen.getByText('label.input')).toBeInTheDocument();
    expect(screen.getByText('label.result')).toBeInTheDocument();
  });

  it('renders multiple tool calls', () => {
    const messageWithMultipleTools: McpMessage = {
      id: 'msg-6',
      conversationId: 'conv-1',
      sender: 'assistant',
      index: 5,
      timestamp: Date.now(),
      content: [
        {
          type: 'Generic',
          tools: [
            { name: 'tool_alpha', input: {} },
            { name: 'tool_beta', input: {} },
          ],
        },
      ],
    };
    render(<MessageBubble message={messageWithMultipleTools} />);

    expect(screen.getByText('tool_alpha')).toBeInTheDocument();
    expect(screen.getByText('tool_beta')).toBeInTheDocument();
  });

  it('renders nothing for message with undefined content', () => {
    const emptyMessage: McpMessage = {
      id: 'msg-7',
      conversationId: 'conv-1',
      sender: 'assistant',
      index: 6,
      timestamp: Date.now(),
    };
    render(<MessageBubble message={emptyMessage} />);

    expect(screen.getByText('label.thinking')).toBeInTheDocument();
  });
});

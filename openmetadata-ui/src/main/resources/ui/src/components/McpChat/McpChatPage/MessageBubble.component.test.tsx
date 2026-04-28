/*
 *  Copyright 2026 Collate.
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
import { MessageBubble } from './MessageBubble.component';
import { McpMessage } from '../../../rest/mcpClientAPI';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const userMessage: McpMessage = {
  id: 'msg-1',
  role: 'user',
  content: 'Hello, world!',
  createdAt: '2026-01-01T00:00:00Z',
};

const assistantMessage: McpMessage = {
  id: 'msg-2',
  role: 'assistant',
  content: 'Hi there!',
  createdAt: '2026-01-01T00:00:01Z',
};

const assistantWithToolCalls: McpMessage = {
  id: 'msg-3',
  role: 'assistant',
  content: 'Found results.',
  createdAt: '2026-01-01T00:00:02Z',
  toolCalls: [
    {
      id: 'tc-1',
      name: 'search_metadata',
      input: { query: 'tables' },
      result: { count: 5 },
    },
  ],
};

describe('MessageBubble', () => {
  it('renders user messages with user bubble class', () => {
    render(<MessageBubble message={userMessage} />);

    const bubble = screen.getByTestId('message-bubble-user');

    expect(bubble).toBeInTheDocument();
    expect(bubble).toHaveClass('mcp-message-bubble-user');
  });

  it('renders assistant messages with assistant bubble class', () => {
    render(<MessageBubble message={assistantMessage} />);

    const bubble = screen.getByTestId('message-bubble-assistant');

    expect(bubble).toBeInTheDocument();
    expect(bubble).toHaveClass('mcp-message-bubble-assistant');
  });

  it('renders ToolCallBlock for messages with toolCalls', () => {
    render(<MessageBubble message={assistantWithToolCalls} />);

    expect(screen.getByTestId('tool-call-block')).toBeInTheDocument();
  });

  it('renders message content text', () => {
    render(<MessageBubble message={userMessage} />);

    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });
});

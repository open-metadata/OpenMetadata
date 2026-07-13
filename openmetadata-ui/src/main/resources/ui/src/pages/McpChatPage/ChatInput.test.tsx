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
import ChatInput from './ChatInput';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./ChatInput.less', () => ({}));

describe('ChatInput', () => {
  it('renders the textarea and send button', () => {
    render(<ChatInput />);

    expect(screen.getByTestId('mcp-chat-input')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-send-button')).toBeInTheDocument();
  });

  it('renders stop button when isSending is true', () => {
    render(<ChatInput isSending />);

    expect(screen.getByTestId('mcp-stop-button')).toBeInTheDocument();
    expect(screen.queryByTestId('mcp-send-button')).not.toBeInTheDocument();
  });

  it('send button is disabled when input is empty', () => {
    render(<ChatInput />);

    expect(screen.getByTestId('mcp-send-button')).toBeDisabled();
  });

  it('send button is enabled when input has text', () => {
    render(<ChatInput />);

    fireEvent.change(screen.getByTestId('mcp-chat-input'), {
      target: { value: 'Hello' },
    });

    expect(screen.getByTestId('mcp-send-button')).not.toBeDisabled();
  });

  it('calls onSendMessage with the typed text when send button is clicked', () => {
    const onSendMessage = jest.fn();
    render(<ChatInput onSendMessage={onSendMessage} />);

    fireEvent.change(screen.getByTestId('mcp-chat-input'), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByTestId('mcp-send-button'));

    expect(onSendMessage).toHaveBeenCalledWith('Hello');
  });

  it('clears the input after sending a message', () => {
    render(<ChatInput onSendMessage={jest.fn()} />);

    fireEvent.change(screen.getByTestId('mcp-chat-input'), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByTestId('mcp-send-button'));

    expect(screen.getByTestId('mcp-chat-input')).toHaveValue('');
  });

  it('calls onSendMessage when Enter is pressed without Shift', () => {
    const onSendMessage = jest.fn();
    render(<ChatInput onSendMessage={onSendMessage} />);

    const textarea = screen.getByTestId('mcp-chat-input');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSendMessage).toHaveBeenCalledWith('Hello');
  });

  it('does not send when Shift+Enter is pressed', () => {
    const onSendMessage = jest.fn();
    render(<ChatInput onSendMessage={onSendMessage} />);

    const textarea = screen.getByTestId('mcp-chat-input');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('does not call onSendMessage when input is whitespace only', () => {
    const onSendMessage = jest.fn();
    render(<ChatInput onSendMessage={onSendMessage} />);

    fireEvent.change(screen.getByTestId('mcp-chat-input'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByTestId('mcp-send-button'));

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('does not call onSendMessage when disabled', () => {
    const onSendMessage = jest.fn();
    render(<ChatInput disabled onSendMessage={onSendMessage} />);

    fireEvent.change(screen.getByTestId('mcp-chat-input'), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByTestId('mcp-send-button'));

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('does not call onSendMessage when isSending is true', async () => {
    const onSendMessage = jest.fn();
    render(<ChatInput isSending onSendMessage={onSendMessage} />);

    expect(screen.queryByTestId('mcp-send-button')).not.toBeInTheDocument();
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('calls onStop when stop button is clicked', () => {
    const onStop = jest.fn();
    render(<ChatInput isSending onStop={onStop} />);

    fireEvent.click(screen.getByTestId('mcp-stop-button'));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onChange when input value changes', () => {
    const onChange = jest.fn();
    render(<ChatInput onChange={onChange} />);

    fireEvent.change(screen.getByTestId('mcp-chat-input'), {
      target: { value: 'A' },
    });

    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('syncs with external value prop', () => {
    const { rerender } = render(<ChatInput value="initial" />);

    expect(screen.getByTestId('mcp-chat-input')).toHaveValue('initial');

    rerender(<ChatInput value="updated" />);

    expect(screen.getByTestId('mcp-chat-input')).toHaveValue('updated');
  });
});

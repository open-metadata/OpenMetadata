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

import { PauseOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ChatInput.less';

export interface ChatInputProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  isSending?: boolean;
  onSendMessage?: (message: string) => void;
  onStop?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = memo(
  ({
    value = '',
    onChange,
    disabled = false,
    isSending = false,
    onSendMessage,
    onStop,
  }) => {
    const { t } = useTranslation();
    const [localValue, setLocalValue] = useState(value);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      onChange?.(newValue);
    };

    const handleSend = () => {
      if (!localValue.trim() || disabled || isSending) {
        return;
      }

      onSendMessage?.(localValue);
      setLocalValue('');
      onChange?.('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const textareaCallbackRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
      },
      []
    );

    return (
      <div className="prompt-input-container p-xs">
        <div className="prompt-footer-container">
          <div className="d-flex items-center justify-between w-100">
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 10 }}
              className="prompt-input-box"
              data-testid="mcp-chat-input"
              placeholder={t('message.mcp-chat-placeholder')}
              readOnly={disabled}
              ref={(antRef) => {
                const domNode = (
                  antRef as unknown as {
                    resizableTextArea?: { textArea?: HTMLTextAreaElement };
                  }
                )?.resizableTextArea?.textArea;
                textareaCallbackRef(domNode ?? null);
              }}
              value={localValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
            />

            {isSending ? (
              <Button
                aria-label={t('label.stop')}
                className="prompt-stop-btn"
                data-testid="mcp-stop-button"
                disabled={!onStop}
                icon={<PauseOutlined />}
                shape="circle"
                title={t('label.stop')}
                onClick={onStop}
              />
            ) : (
              <Button
                aria-label={t('label.send')}
                className="prompt-send-btn"
                data-testid="mcp-send-button"
                disabled={!localValue.trim() || disabled}
                icon={<SendOutlined />}
                shape="circle"
                title={t('label.send')}
                onClick={handleSend}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';

export default ChatInput;

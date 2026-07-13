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

import { ChevronDown } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import React, { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import Loader from '../../components/common/Loader/Loader';
import {
  McpMessage,
  MessageBlock,
  ToolCallInfo,
} from '../../rest/mcpClientAPI';
import './MessageBubble.less';

export interface MessageBubbleProps {
  message: McpMessage;
}

interface ToolCallDisplayProps {
  tool: ToolCallInfo;
}

const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ tool }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tw:rounded tw:border tw:border-border-secondary tw:bg-gray-50 tw:mb-1">
      <button
        className="tw:flex tw:w-full tw:items-center tw:justify-between tw:px-2 tw:py-1 tw:border-0 tw:bg-transparent tw:cursor-pointer"
        onClick={() => setExpanded((prev) => !prev)}>
        <span className="tw:text-xs tw:text-secondary">{tool.name}</span>
        <ChevronDown
          className={`tw:size-3 tw:text-secondary tw:transition-transform ${
            expanded ? 'tw:rotate-180' : ''
          }`}
        />
      </button>
      {expanded && (
        <div className="tw:px-2 tw:pb-2">
          {tool.input && (
            <div className="tw:mb-2">
              <span className="tw:text-xs tw:font-semibold tw:text-secondary">
                {t('label.input')}
              </span>
              <pre className="tw:text-[11px] tw:overflow-auto tw:max-h-50 tw:bg-gray-100 tw:rounded tw:p-2 tw:m-0">
                {JSON.stringify(tool.input, null, 2)}
              </pre>
            </div>
          )}
          {Boolean(tool.result) && (
            <div>
              <span className="tw:text-xs tw:font-semibold tw:text-secondary">
                {t('label.result')}
              </span>
              <pre className="tw:text-[11px] tw:overflow-auto tw:max-h-50 tw:bg-gray-100 tw:rounded tw:p-2 tw:m-0">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message }) => {
  const { t } = useTranslation();
  const isHuman = message.sender === 'human';

  const textContent = useMemo(() => {
    if (!message.content) {
      return '';
    }

    return message.content
      .filter((block: MessageBlock) => block.textMessage)
      .map((block: MessageBlock) => block.textMessage?.message ?? '')
      .join('\n');
  }, [message.content]);

  const toolCalls = useMemo(() => {
    if (!message.content) {
      return [];
    }

    return message.content
      .filter((block: MessageBlock) => !isEmpty(block.tools))
      .flatMap((block: MessageBlock) => block.tools ?? []);
  }, [message.content]);

  const isMarkdown = useMemo(() => {
    if (!message.content) {
      return false;
    }

    return message.content.some(
      (block: MessageBlock) => block.textMessage?.type === 'markdown'
    );
  }, [message.content]);

  const isThinking = !isHuman && isEmpty(textContent) && isEmpty(toolCalls);

  return (
    <div
      className={`tw:flex tw:mb-4 ${
        isHuman ? 'tw:justify-end' : 'tw:justify-start'
      }`}>
      <div
        className={`tw:px-4 tw:py-3 tw:tw:wrap-break-word ${
          isHuman
            ? 'tw:max-w-[60%] tw:rounded-xl human-message'
            : 'tw:max-w-full tw:rounded-lg tw:bg-primary tw:text-primary tw:border tw:border-border-secondary'
        }`}>
        {isThinking && (
          <div className="tw:flex tw:items-center tw:gap-2">
            <Loader size="x-small" />
            <span className="tw:text-sm tw:text-secondary">
              {t('label.thinking')}
            </span>
          </div>
        )}
        {!isEmpty(textContent) &&
          (isMarkdown && !isHuman ? (
            <div className="message-markdown">
              <ReactMarkdown>{textContent}</ReactMarkdown>
            </div>
          ) : (
            <span className="tw:text-sm tw:whitespace-pre-wrap">
              {textContent}
            </span>
          ))}
        {!isEmpty(toolCalls) && (
          <div className="tw:mt-2">
            {toolCalls.map((tool: ToolCallInfo, index: number) => (
              <ToolCallDisplay key={`${tool.name}-${index}`} tool={tool} />
            ))}
          </div>
        )}
        {message.tokens && (
          <span className="tw:block tw:mt-1 tw:text-xs tw:text-secondary">
            {message.tokens.totalTokens
              ? `${message.tokens.totalTokens} ${t('label.token-plural')}`
              : ''}
          </span>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;

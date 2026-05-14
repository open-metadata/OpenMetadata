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

import { isEmpty } from 'lodash';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import { McpMessage } from '../../rest/mcpClientAPI';
import MessageBubble from './MessageBubble';

export interface MessageListProps {
  messages: McpMessage[];
  isLoading: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  endRef: React.RefObject<HTMLDivElement | null>;
}

const MemoizedMessageBubble = memo<{ message: McpMessage }>(({ message }) => (
  <MessageBubble message={message} />
));

MemoizedMessageBubble.displayName = 'MemoizedMessageBubble';

const MessageList: React.FC<MessageListProps> = memo(
  ({ messages, isLoading, containerRef, endRef }) => {
    const { t } = useTranslation();

    const renderedMessages = useMemo(
      () =>
        messages.map((message) => (
          <MemoizedMessageBubble key={message.id} message={message} />
        )),
      [messages]
    );

    if (isLoading) {
      return (
        <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center">
          <Loader />
        </div>
      );
    }

    if (isEmpty(messages)) {
      return (
        <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center">
          <span className="tw:text-sm tw:text-secondary">
            {t('message.mcp-chat-empty')}
          </span>
        </div>
      );
    }

    return (
      <div
        className="tw:flex-1 tw:min-h-0 tw:overflow-auto tw:px-6 tw:py-4"
        ref={containerRef}>
        {renderedMessages}
        <div ref={endRef} />
      </div>
    );
  }
);

MessageList.displayName = 'MessageList';

export default MessageList;

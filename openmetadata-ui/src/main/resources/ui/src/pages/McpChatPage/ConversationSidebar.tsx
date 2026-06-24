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

import { Typography } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { McpConversation } from '../../rest/mcpClientAPI';
import ChatList from './ChatList';
import NavItem from './NavItem';

export interface ConversationSidebarProps {
  conversations: McpConversation[];
  activeConversationId: string | undefined;
  isLoading: boolean;
  isLoadingMore?: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onLoadMore?: () => void;
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversationId,
  isLoading,
  isLoadingMore = false,
  onSelect,
  onNewChat,
  onDelete,
  onLoadMore,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:flex tw:flex-col tw:w-68.5 tw:h-full tw:overflow-hidden tw:bg-primary"
      data-testid="mcp-conversation-sidebar">
      <div className="tw:flex tw:flex-col tw:h-full tw:p-4 tw:border-r tw:border-gray-100">
        <header className="tw:flex tw:items-center tw:gap-2 tw:h-6 tw:shrink-0">
          <Typography className="tw:text-primary" weight="semibold">
            {t('label.mcp-chat')}
          </Typography>
        </header>
        <div className="tw:my-2 tw:mt-3">
          <NavItem
            dataTestId="new-chat-button"
            icon={Plus}
            label={t('label.new-chat')}
            onClick={onNewChat}
          />
        </div>
        <div className="tw:flex tw:flex-1 tw:flex-col tw:min-h-0 tw:overflow-hidden">
          <ChatList
            activeConversationId={activeConversationId}
            conversations={conversations}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            onDelete={onDelete}
            onLoadMore={onLoadMore}
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>
  );
};

export default ConversationSidebar;

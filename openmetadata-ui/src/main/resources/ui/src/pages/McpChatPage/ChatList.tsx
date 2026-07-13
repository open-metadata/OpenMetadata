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

import { Trash01 } from '@untitledui/icons';
import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DeleteModal from '../../components/common/DeleteModal/DeleteModal';
import Loader from '../../components/common/Loader/Loader';
import { McpConversation } from '../../rest/mcpClientAPI';

export interface ChatListProps {
  conversations: McpConversation[];
  activeConversationId?: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onLoadMore?: () => void;
}

const ChatList: React.FC<ChatListProps> = ({
  conversations,
  activeConversationId,
  isLoading,
  isLoadingMore,
  onSelect,
  onDelete,
  onLoadMore,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !onLoadMore) {
      return undefined;
    }

    const handleScroll = () => {
      if (isLoading || isLoadingMore) {
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = node;
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        onLoadMore();
      }
    };

    node.addEventListener('scroll', handleScroll);

    return () => node.removeEventListener('scroll', handleScroll);
  }, [isLoading, isLoadingMore, onLoadMore]);

  if (isLoading) {
    return (
      <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center">
        <Loader size="small" />
      </div>
    );
  }

  const renderItem = (conversation: McpConversation) => (
    <li
      className={classNames(
        'tw:group tw:flex tw:items-center tw:h-9 tw:p-1 tw:rounded',
        'tw:transition-colors tw:duration-150 tw:ease-linear',
        {
          'tw:hover:bg-[rgba(0,0,0,0.04)]':
            conversation.id !== activeConversationId,
          'tw:bg-blue-50': conversation.id === activeConversationId,
        }
      )}
      key={conversation.id}>
      <button
        className="tw:flex-1 tw:min-w-0 tw:bg-transparent tw:border-0 tw:p-0 tw:text-left tw:cursor-pointer"
        title={conversation.title}
        type="button"
        onClick={() => onSelect(conversation.id)}>
        <span className="tw:block tw:truncate tw:text-sm tw:font-normal tw:text-primary tw:leading-5">
          {conversation.title ??
            `${t('label.conversation')} ${conversation.id.slice(0, 8)}`}
        </span>
      </button>
      <button
        className={classNames(
          'tw:opacity-0 tw:group-hover:opacity-100',
          'tw:bg-transparent tw:border-0 tw:p-1 tw:cursor-pointer tw:rounded',
          'tw:flex tw:items-center tw:justify-center',
          'tw:text-tertiary tw:shrink-0',
          'tw:transition-opacity tw:duration-150 tw:ease-linear',
          'tw:hover:bg-[rgba(0,0,0,0.04)]'
        )}
        data-testid={`delete-conversation-${conversation.id}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDeletingId(conversation.id);
        }}>
        <Trash01 className="tw:size-3.5" />
      </button>
    </li>
  );

  const deletingConversation = conversations.find((c) => c.id === deletingId);

  return (
    <>
      <div
        className="tw:flex tw:flex-1 tw:flex-col tw:gap-3 tw:min-h-0 tw:overflow-y-auto"
        ref={scrollRef}>
        {conversations.length > 0 ? (
          <div className="tw:flex tw:flex-col">
            <div className="tw:text-xs tw:font-medium tw:text-quaternary tw:px-1 tw:py-2">
              {t('label.recent-chat')}
            </div>
            <ul className="tw:list-none tw:m-0 tw:p-0 tw:flex tw:flex-col tw:gap-0.5 tw:ml-1">
              {conversations.map(renderItem)}
            </ul>
          </div>
        ) : null}
        {isLoadingMore ? (
          <div className="tw:flex tw:justify-center tw:h-6">
            <Loader size="small" />
          </div>
        ) : null}
      </div>
      <DeleteModal
        entityTitle={
          deletingConversation?.title ??
          `${t('label.conversation')} ${deletingId?.slice(0, 8)}`
        }
        message={t('message.confirm-delete-message')}
        open={deletingId !== null}
        onCancel={() => setDeletingId(null)}
        onDelete={() => {
          if (deletingId) {
            onDelete(deletingId);
          }
          setDeletingId(null);
        }}
      />
    </>
  );
};

export default ChatList;

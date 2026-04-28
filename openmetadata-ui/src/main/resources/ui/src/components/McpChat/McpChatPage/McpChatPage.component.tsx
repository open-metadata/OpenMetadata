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

import { Button, Input, Layout, List, Popconfirm, Skeleton, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  deleteConversation,
  getConversationMessages,
  getConversations,
  McpConversation,
  McpMessage,
  streamChat,
} from '../../../rest/mcpClientAPI';
import { MessageBubble } from './MessageBubble.component';
import { TypingIndicator } from './TypingIndicator.component';
import './McpChatPage.less';

const { Sider, Content } = Layout;
const { Title, Paragraph } = Typography;
const { TextArea } = Input;

export const McpChatPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversationId: routeConversationId } =
    useParams<{ conversationId?: string }>();

  /* ---- State ---- */
  const [conversations, setConversations] = useState<McpConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(routeConversationId ?? null);
  const [messages, setMessages] = useState<McpMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  /* ---- Refs ---- */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeConversationIdRef = useRef<string | null>(routeConversationId ?? null);

  /* ---- BUG 1 FIX: abort in-flight stream on unmount ---- */
  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  /* ---- Auto-scroll on new messages ---- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  /* ---- Load conversations on mount ---- */
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsLoadingConversations(true);
        const data = await getConversations();
        setConversations(data);
      } catch {
        // silently handle — user will see empty list
      } finally {
        setIsLoadingConversations(false);
      }
    };
    loadConversations();
  }, []);

  /* ---- Load messages when active conversation changes ---- */
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);

      return;
    }

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const data = await getConversationMessages(activeConversationId);
        setMessages(data);
      } catch {
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [activeConversationId]);

  /* ---- Sync route param → state ---- */
  useEffect(() => {
    setActiveConversationId(routeConversationId ?? null);
  }, [routeConversationId]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  /* ---- Select conversation ---- */
  const handleSelectConversation = useCallback(
    (id: string) => {
      navigate(`/mcp-chat/${id}`);
    },
    [navigate]
  );

  /* ---- New conversation ---- */
  const handleNewConversation = useCallback(() => {
    navigate('/mcp-chat');
    setActiveConversationId(null);
    setMessages([]);
  }, [navigate]);

  /* ---- Delete conversation ---- */
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          handleNewConversation();
        }
      } catch {
        // silently handle
      }
    },
    [activeConversationId, handleNewConversation]
  );

  /* ---- Send message ---- */
  const handleSendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) {
      return;
    }

    setInputValue('');
    setIsStreaming(true);

    // Optimistic user message
    const optimisticMsg: McpMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // BUG 2 FIX: abort any previous in-flight stream before starting a new one
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Accumulate partial assistant content
    let assistantContent = '';
    let assistantToolCalls: McpMessage['toolCalls'] = [];

    try {
      // BUG 1+2 FIX: pass signal to streamChat
      const generator = streamChat(
        {
          conversationId: activeConversationId ?? undefined,
          message: text,
        },
        abortRef.current.signal
      );

      for await (const event of generator) {
        if (abortRef.current.signal.aborted) {
          break;
        }

        switch (event.type) {
          case 'token':
            assistantContent += event.data;
            setMessages((prev) => {
              const existing = prev.find(
                (m) => m.id === 'streaming-assistant'
              );
              const streamingMsg: McpMessage = {
                id: 'streaming-assistant',
                role: 'assistant',
                content: assistantContent,
                createdAt: new Date().toISOString(),
                toolCalls: assistantToolCalls,
              };

              return existing
                ? prev.map((m) =>
                    m.id === 'streaming-assistant' ? streamingMsg : m
                  )
                : [...prev, streamingMsg];
            });

            break;

          case 'tool_call':
            assistantToolCalls = [
              ...(assistantToolCalls ?? []),
              event.toolCall,
            ];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === 'streaming-assistant'
                  ? { ...m, toolCalls: assistantToolCalls }
                  : m
              )
            );

            break;

          case 'message_complete': {
            const completeMsg = event.message;
            setMessages((prev) =>
              prev
                .filter(
                  (m) => m.id !== 'streaming-assistant'
                )
                .concat(completeMsg)
            );

            // Update conversation in sidebar if new
            if (
              completeMsg.id &&
              !activeConversationIdRef.current
            ) {
              const refreshed = await getConversations();
              setConversations(refreshed);

              // Navigate to the newly created conversation
              if (refreshed.length > 0) {
                navigate(`/mcp-chat/${refreshed[0].id}`);
              }
            }

            break;
          }

          case 'error':
            setMessages((prev) => [
              ...prev,
              {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: `⚠️ ${event.error}`,
                createdAt: new Date().toISOString(),
              },
            ]);

            break;
        }
      }
    } catch (error) {
      // Only show error if not aborted
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ ${t('message.mcp-chat-stream-error')}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      // BUG 5 FIX: always clean up optimistic messages in finally
      setMessages((prev) =>
        prev.filter(
          (m) =>
            !m.id.startsWith('optimistic-') &&
            m.id !== 'streaming-assistant'
        )
      );
      setIsStreaming(false);
    }
  }, [inputValue, isStreaming, activeConversationId, navigate, t]);

  /* ---- Key handler ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  return (
    <Layout className="mcp-chat-page" data-testid="mcp-chat-page">
      {/* ----- Sidebar ----- */}
      <Sider className="mcp-chat-sidebar" theme="light" width={280}>
        <div className="mcp-chat-sidebar-header">
          <Button
            block
            data-testid="new-conversation-btn"
            type="primary"
            onClick={handleNewConversation}>
            {t('label.new-conversation')}
          </Button>
        </div>

        {isLoadingConversations ? (
          <div className="p-md">
            <Skeleton active paragraph={{ rows: 4 }} />
          </div>
        ) : (
          <List
            className="mcp-conversation-list"
            dataSource={conversations}
            locale={{
              emptyText: t('label.no-conversation-plural'),
            }}
            renderItem={(conversation) => (
              <List.Item
                className={`mcp-conversation-item ${
                  conversation.id === activeConversationId
                    ? 'mcp-conversation-item-active'
                    : ''
                }`}
                data-testid={`conversation-${conversation.id}`}
                onClick={() => handleSelectConversation(conversation.id)}>
                <List.Item.Meta
                  description={new Date(
                    conversation.updatedAt
                  ).toLocaleDateString()}
                  title={conversation.title || t('label.new-conversation')}
                />
                <Popconfirm
                  cancelText={t('label.cancel')}
                  okText={t('label.delete')}
                  title={t('message.confirm-delete-conversation')}
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleDeleteConversation(conversation.id);
                  }}>
                  <Button
                    className="mcp-delete-btn"
                    data-testid={`delete-conversation-${conversation.id}`}
                    size="small"
                    type="text"
                    onClick={(e) => e.stopPropagation()}>
                    ✕
                  </Button>
                </Popconfirm>
              </List.Item>
            )}
          />
        )}
      </Sider>

      {/* ----- Main content ----- */}
      <Content className="mcp-chat-content">
        {!activeConversationId && messages.length === 0 ? (
          <div className="mcp-empty-state" data-testid="mcp-empty-state">
            <Title level={3}>{t('message.mcp-chat-welcome')}</Title>
            <Paragraph type="secondary">
              {t('message.mcp-chat-description')}
            </Paragraph>
          </div>
        ) : (
          <div className="mcp-chat-messages" data-testid="mcp-chat-messages">
            {isLoadingMessages ? (
              <div className="p-lg">
                <Skeleton active paragraph={{ rows: 6 }} />
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble
                    isStreaming={
                      isStreaming && msg.id === 'streaming-assistant'
                    }
                    key={msg.id}
                    message={msg}
                  />
                ))}
                {isStreaming &&
                  !messages.some((m) => m.id === 'streaming-assistant') && (
                    <TypingIndicator />
                  )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ----- Input area ----- */}
        <div className="mcp-chat-input-area" data-testid="mcp-chat-input-area">
          <TextArea
            autoSize={{ minRows: 1, maxRows: 4 }}
            data-testid="mcp-chat-input"
            disabled={isStreaming}
            placeholder={t('label.type-message-placeholder')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            data-testid="send-message-btn"
            disabled={!inputValue.trim() || isStreaming}
            type="primary"
            onClick={handleSendMessage}>
            {t('label.send-message')}
          </Button>
        </div>
      </Content>
    </Layout>
  );
};

export default McpChatPage;

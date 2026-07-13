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

import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChatStreamEvent,
  deleteConversation,
  listConversations,
  listMessages,
  McpConversation,
  McpMessage,
  streamChatMessage,
} from '../../rest/mcpClientAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import ChatInput from './ChatInput';
import ConversationSidebar from './ConversationSidebar';
import MessageList from './MessageList';

const McpChatPage = () => {
  const { t } = useTranslation();
  const { id: conversationIdFromUrl } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<McpConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(conversationIdFromUrl);
  const [messages, setMessages] = useState<McpMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingConversations, setIsLoadingConversations] =
    useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const response = await listConversations();
      setConversations(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      setIsLoading(true);
      try {
        const response = await listMessages(conversationId);
        setMessages(response.data);
        scrollToBottom('auto');
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [scrollToBottom]
  );

  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      abortControllerRef.current?.abort();
      setActiveConversationId(conversationId);
      navigate(`/mcp-chat/${conversationId}`, { replace: true });
    },
    [navigate]
  );

  const handleNewChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setActiveConversationId(undefined);
    setMessages([]);
    navigate('/mcp-chat', { replace: true });
  }, [navigate]);

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await deleteConversation(conversationId);
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (activeConversationId === conversationId) {
          handleNewChat();
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [activeConversationId, handleNewChat]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
  }, []);

  const handleSendMessage = useCallback(
    async (message: string) => {
      const trimmedInput = message.trim();
      if (isEmpty(trimmedInput) || isSending) {
        return;
      }

      const userMessage: McpMessage = {
        id: `temp-user-${Date.now()}`,
        conversationId: activeConversationId ?? '',
        sender: 'human',
        index: messages.length,
        timestamp: Date.now(),
        content: [
          {
            type: 'Generic',
            textMessage: { type: 'plain', message: trimmedInput },
          },
        ],
      };

      const assistantTempId = `temp-assistant-${Date.now()}`;
      const assistantMessage: McpMessage = {
        id: assistantTempId,
        conversationId: activeConversationId ?? '',
        sender: 'assistant',
        index: messages.length + 1,
        timestamp: Date.now(),
        content: [],
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsSending(true);

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await streamChatMessage(
          {
            conversationId: activeConversationId,
            message: trimmedInput,
          },
          {
            onEvent: (event: ChatStreamEvent) => {
              switch (event.event) {
                case 'conversation_created':
                  setActiveConversationId(event.data.conversationId);
                  navigate(`/mcp-chat/${event.data.conversationId}`, {
                    replace: true,
                  });
                  fetchConversations();

                  break;

                case 'text':
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantTempId) {
                        return m;
                      }
                      const existingText =
                        m.content?.find((b) => b.textMessage)?.textMessage
                          ?.message ?? '';
                      const newText = existingText + event.data.content;

                      return {
                        ...m,
                        content: [
                          {
                            type: 'Generic' as const,
                            textMessage: {
                              type: 'markdown' as const,
                              message: newText,
                            },
                            tools: m.content?.[0]?.tools,
                          },
                        ],
                      };
                    })
                  );

                  break;

                case 'tool_call_start':
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantTempId) {
                        return m;
                      }
                      const currentTools = m.content?.[0]?.tools ?? [];
                      const updatedTools = [
                        ...currentTools,
                        {
                          name: event.data.name,
                          input: event.data.input,
                        },
                      ];

                      return {
                        ...m,
                        content: [
                          {
                            type: 'Generic' as const,
                            textMessage: m.content?.[0]?.textMessage,
                            tools: updatedTools,
                          },
                        ],
                      };
                    })
                  );

                  break;

                case 'tool_call_end':
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantTempId) {
                        return m;
                      }
                      const updatedTools = (m.content?.[0]?.tools ?? []).map(
                        (tool) => {
                          if (
                            tool.name === event.data.name &&
                            tool.result === undefined
                          ) {
                            return { ...tool, result: event.data.result };
                          }

                          return tool;
                        }
                      );

                      return {
                        ...m,
                        content: [
                          {
                            type: 'Generic' as const,
                            textMessage: m.content?.[0]?.textMessage,
                            tools: updatedTools,
                          },
                        ],
                      };
                    })
                  );

                  break;

                case 'message_complete':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantTempId ? event.data.message : m
                    )
                  );

                  break;

                case 'error':
                  showErrorToast(event.data.message);

                  break;

                case 'title_updated':
                  fetchConversations();

                  break;

                case 'done':
                  break;
              }
            },
            onError: (error: Error) => {
              showErrorToast(error.message);
            },
          },
          controller.signal
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        showErrorToast(error as AxiosError);
        setMessages((prev) =>
          prev.filter(
            (m) => m.id !== userMessage.id && m.id !== assistantTempId
          )
        );
      } finally {
        setIsSending(false);
      }
    },
    [
      isSending,
      activeConversationId,
      messages.length,
      fetchConversations,
      navigate,
    ]
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (conversationIdFromUrl && !isSending) {
      fetchMessages(conversationIdFromUrl);
    }
  }, [conversationIdFromUrl, fetchMessages, isSending]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="tw:flex tw:h-[calc(100vh-96px)] tw:overflow-hidden tw:mx-6 tw:rounded-2xl">
      <ConversationSidebar
        activeConversationId={activeConversationId}
        conversations={conversations}
        isLoading={isLoadingConversations}
        onDelete={handleDeleteConversation}
        onNewChat={handleNewChat}
        onSelect={handleConversationSelect}
      />
      <div className="tw:flex tw:flex-1 tw:flex-col tw:overflow-hidden tw:bg-primary">
        {activeConversationId || !isEmpty(messages) ? (
          <>
            <MessageList
              containerRef={messagesContainerRef}
              endRef={messagesEndRef}
              isLoading={isLoading}
              messages={messages}
            />
            <div className="tw:shrink-0 tw:p-4">
              <ChatInput
                isSending={isSending}
                onSendMessage={handleSendMessage}
                onStop={handleStop}
              />
            </div>
          </>
        ) : (
          <div className="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:justify-center">
            <span className="tw:text-lg tw:text-secondary tw:mb-6">
              {t('message.mcp-chat-empty')}
            </span>
            <div className="tw:w-full tw:max-w-140 tw:px-4">
              <ChatInput
                isSending={isSending}
                onSendMessage={handleSendMessage}
                onStop={handleStop}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default McpChatPage;

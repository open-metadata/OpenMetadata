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

import { Button, Divider, Tooltip } from '@openmetadata/ui-core-components';
import { ChevronDown, Send01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactComponent as AddChatIcon } from '../../assets/svg/add-chat.svg';
import { ReactComponent as TrashIcon } from '../../assets/svg/ic-trash.svg';
import Loader from '../../components/common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import {
  ChatStreamEvent,
  deleteConversation,
  listConversations,
  listMessages,
  McpConversation,
  McpMessage,
  MessageBlock,
  streamChatMessage,
  ToolCallInfo,
} from '../../rest/mcpClientAPI';
import { showErrorToast } from '../../utils/ToastUtils';

const MAX_TEXTAREA_HEIGHT = 96;

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
  const [inputValue, setInputValue] = useState<string>('');

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
    setInputValue('');
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

  const handleSendMessage = useCallback(async () => {
    const trimmedInput = inputValue.trim();
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
    setInputValue('');
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
        prev.filter((m) => m.id !== userMessage.id && m.id !== assistantTempId)
      );
      setInputValue(trimmedInput);
    } finally {
      setIsSending(false);
    }
  }, [
    inputValue,
    isSending,
    activeConversationId,
    messages.length,
    fetchConversations,
    navigate,
  ]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
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

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  return (
    <div className="tw:flex tw:h-full tw:overflow-hidden">
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
            {activeConversation?.title && (
              <div className="tw:px-6 tw:py-3 tw:border-b tw:border-border-secondary">
                <span className="tw:font-semibold tw:text-base tw:text-primary">
                  {activeConversation.title}
                </span>
              </div>
            )}
            <MessageList
              containerRef={messagesContainerRef}
              endRef={messagesEndRef}
              isLoading={isLoading}
              messages={messages}
            />
            <ChatInput
              inputValue={inputValue}
              isSending={isSending}
              onKeyDown={handleKeyDown}
              onSend={handleSendMessage}
              onValueChange={setInputValue}
            />
          </>
        ) : (
          <div className="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:justify-center">
            <span className="tw:text-lg tw:text-secondary tw:mb-6">
              {t('message.mcp-chat-empty')}
            </span>
            <div className="tw:w-full tw:max-w-[560px] tw:px-4">
              <ChatInput
                inputValue={inputValue}
                isSending={isSending}
                onKeyDown={handleKeyDown}
                onSend={handleSendMessage}
                onValueChange={setInputValue}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ConversationSidebarProps {
  conversations: McpConversation[];
  activeConversationId: string | undefined;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}

const ConversationSidebar = ({
  conversations,
  activeConversationId,
  isLoading,
  onSelect,
  onNewChat,
  onDelete,
}: ConversationSidebarProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:flex-col tw:w-[280px] tw:min-w-[280px] tw:border-r tw:border-border-secondary tw:bg-white">
      <div className="tw:flex tw:items-center tw:justify-between tw:px-4 tw:py-3">
        <span className="tw:font-semibold tw:text-base tw:text-primary">
          {t('label.mcp-chat')}
        </span>
        <Tooltip title={t('label.new-chat')}>
          <Button
            color="secondary"
            data-testid="new-chat-button"
            iconLeading={<AddChatIcon height={20} width={20} />}
            size="sm"
            onClick={onNewChat}
          />
        </Tooltip>
      </div>
      <Divider />
      <div className="tw:flex-1 tw:overflow-auto">
        {isLoading ? (
          <div className="tw:flex tw:justify-center tw:p-6">
            <Loader size="small" />
          </div>
        ) : (
          <div>
            {conversations.map((conversation) => {
              const isSelected = conversation.id === activeConversationId;

              return (
                <div
                  className={`tw:group tw:flex tw:items-center tw:cursor-pointer tw:px-4 tw:py-2 ${
                    isSelected
                      ? 'tw:bg-gray-100'
                      : 'tw:bg-transparent tw:hover:bg-gray-50'
                  }`}
                  data-testid={`conversation-item-${conversation.id}`}
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(conversation.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSelect(conversation.id);
                    }
                  }}>
                  <span
                    className={`tw:flex-1 tw:truncate tw:text-sm tw:text-primary ${
                      isSelected ? 'tw:font-semibold' : ''
                    }`}>
                    {conversation.title ??
                      `${t('label.conversation')} ${conversation.id.slice(
                        0,
                        8
                      )}`}
                  </span>
                  <button
                    className="tw:opacity-0 tw:group-hover:opacity-100 tw:border-0 tw:bg-transparent tw:p-1 tw:cursor-pointer tw:rounded tw:hover:bg-gray-200"
                    data-testid={`delete-conversation-${conversation.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conversation.id);
                    }}>
                    <TrashIcon height={14} width={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface MessageListProps {
  messages: McpMessage[];
  isLoading: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  endRef: React.RefObject<HTMLDivElement | null>;
}

const MessageList = ({
  messages,
  isLoading,
  containerRef,
  endRef,
}: MessageListProps) => {
  const { t } = useTranslation();

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
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
};

interface MessageBubbleProps {
  message: McpMessage;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
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
        className={`tw:max-w-[70%] tw:px-4 tw:py-3 tw:rounded-lg ${
          isHuman
            ? 'tw:bg-brand-solid tw:text-primary_on-brand'
            : 'tw:bg-white tw:text-primary tw:border tw:border-border-secondary'
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
            <RichTextEditorPreviewerV1
              enableSeeMoreVariant={false}
              markdown={textContent}
            />
          ) : (
            <span className="tw:text-sm tw:whitespace-pre-wrap tw:break-words">
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
};

interface ToolCallDisplayProps {
  tool: ToolCallInfo;
}

const ToolCallDisplay = ({ tool }: ToolCallDisplayProps) => {
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
              <pre className="tw:text-[11px] tw:overflow-auto tw:max-h-[200px] tw:bg-gray-100 tw:rounded tw:p-2 tw:m-0">
                {JSON.stringify(tool.input, null, 2)}
              </pre>
            </div>
          )}
          {tool.result && (
            <div>
              <span className="tw:text-xs tw:font-semibold tw:text-secondary">
                {t('label.result')}
              </span>
              <pre className="tw:text-[11px] tw:overflow-auto tw:max-h-[200px] tw:bg-gray-100 tw:rounded tw:p-2 tw:m-0">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ChatInputProps {
  inputValue: string;
  isSending: boolean;
  onValueChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

const ChatInput = ({
  inputValue,
  isSending,
  onValueChange,
  onSend,
  onKeyDown,
}: ChatInputProps) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(
        textarea.scrollHeight,
        MAX_TEXTAREA_HEIGHT
      )}px`;
    }
  }, [inputValue]);

  return (
    <div className="tw:flex-shrink-0 tw:p-4">
      <div className="tw:flex tw:items-end tw:gap-2 tw:rounded-xl tw:border tw:border-border-secondary tw:bg-white tw:px-3 tw:py-2">
        <textarea
          className="tw:flex-1 tw:resize-none tw:border-0 tw:bg-transparent tw:text-sm tw:text-primary tw:outline-none tw:placeholder:text-tertiary"
          data-testid="mcp-chat-input"
          disabled={isSending}
          placeholder={t('message.mcp-chat-placeholder')}
          ref={textareaRef}
          rows={1}
          value={inputValue}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button
          color="secondary"
          data-testid="mcp-send-button"
          iconLeading={<Send01 className="tw:size-4" />}
          isDisabled={isEmpty(inputValue.trim()) || isSending}
          isLoading={isSending}
          size="sm"
          onClick={onSend}
        />
      </div>
    </div>
  );
};

export default McpChatPage;

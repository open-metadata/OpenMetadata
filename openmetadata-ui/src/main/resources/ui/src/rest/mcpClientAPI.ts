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

import { AxiosResponse } from 'axios';
import APIClient from './index';

export interface McpConversation {
  id: string;
  user: { id: string; name: string; type: string };
  createdAt: number;
  updatedAt: number;
  title?: string;
  messageCount: number;
  mcpMessages?: McpMessage[];
}

export interface TextMessage {
  type: 'plain' | 'markdown';
  message: string;
}

export interface ToolCallInfo {
  name: string;
  input?: Record<string, unknown>;
  result?: unknown;
}

export interface MessageBlock {
  type: 'Generic';
  textMessage?: TextMessage;
  tools?: ToolCallInfo[];
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface McpMessage {
  id: string;
  conversationId: string;
  sender: 'human' | 'assistant';
  index: number;
  timestamp: number;
  content?: MessageBlock[];
  tokens?: TokenUsage;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  message: McpMessage;
}

const BASE = '/mcp-client';

export const sendChatMessage = async (
  request: ChatRequest
): Promise<ChatResponse> => {
  const response = await APIClient.post<
    ChatRequest,
    AxiosResponse<ChatResponse>
  >(`${BASE}/chat`, request);

  return response.data;
};

export const createConversation = async (
  title?: string
): Promise<McpConversation> => {
  const response = await APIClient.post<
    { title?: string },
    AxiosResponse<McpConversation>
  >(`${BASE}/conversations`, { title });

  return response.data;
};

export const listConversations = async (
  limit = 20,
  offset = 0
): Promise<{ data: McpConversation[]; paging: { total: number } }> => {
  const response = await APIClient.get<{
    data: McpConversation[];
    paging: { total: number };
  }>(`${BASE}/conversations`, {
    params: { limit, offset },
  });

  return response.data;
};

export const getConversation = async (id: string): Promise<McpConversation> => {
  const response = await APIClient.get<McpConversation>(
    `${BASE}/conversations/${id}`
  );

  return response.data;
};

export const deleteConversation = async (id: string): Promise<void> => {
  await APIClient.delete(`${BASE}/conversations/${id}`);
};

export const listMessages = async (
  conversationId: string,
  limit = 50,
  offset = 0
): Promise<{ data: McpMessage[] }> => {
  const response = await APIClient.get<{ data: McpMessage[] }>(
    `${BASE}/conversations/${conversationId}/messages`,
    {
      params: { limit, offset },
    }
  );

  return response.data;
};

export type ChatStreamEvent =
  | { event: 'conversation_created'; data: { conversationId: string } }
  | { event: 'text'; data: { content: string } }
  | {
      event: 'tool_call_start';
      data: { name: string; input: Record<string, unknown> };
    }
  | { event: 'tool_call_end'; data: { name: string; result: unknown } }
  | { event: 'message_complete'; data: { message: McpMessage } }
  | { event: 'title_updated'; data: { title: string } }
  | { event: 'error'; data: { message: string } }
  | { event: 'done'; data: Record<string, never> };

export interface ChatStreamCallbacks {
  onEvent: (event: ChatStreamEvent) => void;
  onError?: (error: Error) => void;
}

export const streamChatMessage = async (
  request: ChatRequest,
  callbacks: ChatStreamCallbacks,
  signal?: AbortSignal
): Promise<void> => {
  const { getOidcToken } = await import('../utils/SwTokenStorageUtils');
  const { getBasePath } = await import('../utils/HistoryUtils');

  const token = await getOidcToken();
  const basePath = getBasePath();

  const response = await fetch(`${basePath}/api/v1${BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('ReadableStream not supported');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const eventBlock of events) {
        if (!eventBlock.trim()) {
          continue;
        }

        let eventName = '';
        let eventData = '';

        for (const line of eventBlock.split('\n')) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7);
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);
          }
        }

        if (eventName && eventData) {
          try {
            const parsed = JSON.parse(eventData);
            callbacks.onEvent({
              event: eventName,
              data: parsed,
            } as ChatStreamEvent);
          } catch {
            // skip malformed events
          }
        }
      }
    }
  } catch (error) {
    callbacks.onError?.(
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    reader.releaseLock();
  }
};

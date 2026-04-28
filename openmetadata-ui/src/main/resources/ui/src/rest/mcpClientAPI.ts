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

import { getOidcToken } from '../utils/SwTokenStorageUtils';
import { getBasePath } from '../utils/HistoryUtils';
import APIClient from './index';

/* ---------- Types ---------- */

export interface McpToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
}

export interface McpMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  toolCalls?: McpToolCall[];
}

export interface McpConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatStreamRequest {
  conversationId?: string;
  message: string;
}

export type ChatStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'tool_call'; toolCall: McpToolCall }
  | { type: 'message_complete'; message: McpMessage }
  | { type: 'error'; error: string };

export type StreamErrorEvent = Extract<ChatStreamEvent, { type: 'error' }>;

/* ---------- REST (Axios-based) API functions ---------- */

const BASE_URL = '/mcp-client';

export const getConversations = async (): Promise<McpConversation[]> => {
  const response = await APIClient.get<McpConversation[]>(
    `${BASE_URL}/conversations`
  );

  return response.data;
};

export const getConversationMessages = async (
  conversationId: string
): Promise<McpMessage[]> => {
  const response = await APIClient.get<McpMessage[]>(
    `${BASE_URL}/conversations/${conversationId}/messages`
  );

  return response.data;
};

export const deleteConversation = async (
  conversationId: string
): Promise<void> => {
  await APIClient.delete(`${BASE_URL}/conversations/${conversationId}`);
};

/* ---------- SSE Streaming (native fetch) ---------- */

/**
 * Streams chat events from the MCP client backend using SSE over POST.
 *
 * Native fetch is used instead of EventSource because:
 *  - EventSource only supports GET requests (no request body)
 *  - EventSource does not support custom Authorization headers
 *
 * Bug fixes applied:
 *  - BUG 1+2: signal parameter is accepted and forwarded to fetch()
 *  - BUG 3: JSON.parse is wrapped in try/catch
 *  - BUG 4: SSE parser handles both 'data: payload' and 'data:payload'
 */
export async function* streamChat(
  request: ChatStreamRequest,
  signal?: AbortSignal
): AsyncGenerator<ChatStreamEvent> {
  const token = await getOidcToken();
  const basePath = getBasePath();

  const response = await fetch(
    `${basePath}/api/v1/mcp-client/chat/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
      signal,
    }
  );

  if (!response.ok) {
    yield {
      type: 'error',
      error: `Server returned ${response.status}: ${response.statusText}`,
    };

    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'Response body is not readable' };

    return;
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
      const lines = buffer.split('\n');

      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        // BUG 4 FIX: handle both 'data:payload' and 'data: payload'
        if (!trimmedLine.startsWith('data:')) {
          continue;
        }

        const payload = trimmedLine.startsWith('data: ')
          ? trimmedLine.slice(6).trim()
          : trimmedLine.slice(5).trim();

        // Skip empty payloads and [DONE] sentinel
        if (!payload || payload === '[DONE]') {
          continue;
        }

        // BUG 3 FIX: wrap JSON.parse in try/catch
        try {
          yield JSON.parse(payload) as ChatStreamEvent;
        } catch {
          yield {
            type: 'error',
            error: 'Received malformed event from server',
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

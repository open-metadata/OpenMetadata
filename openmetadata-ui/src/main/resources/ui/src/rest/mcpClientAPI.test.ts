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

import { streamChat } from './mcpClientAPI';

// Mock getOidcToken
jest.mock('../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn().mockResolvedValue('test-token'),
}));

// Mock getBasePath
jest.mock('../utils/HistoryUtils', () => ({
  getBasePath: jest.fn().mockReturnValue(''),
}));

const createMockResponse = (body: string) => {
  const encoder = new TextEncoder();
  const chunk = encoder.encode(body);
  
  let isDone = false;
  const reader = {
    read: async () => {
      if (isDone) return { done: true, value: undefined };
      isDone = true;
      return { done: false, value: chunk };
    },
    releaseLock: jest.fn(),
  };

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader: () => reader,
    },
  } as unknown as Response;
};

describe('streamChat', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('correctly parses "data: {...}" format (with space)', async () => {
    const event = { type: 'token', data: 'hello' };
    global.fetch = jest.fn().mockResolvedValue(
      createMockResponse(`data: ${JSON.stringify(event)}\n\n`)
    );

    const events = [];
    for await (const e of streamChat({ message: 'test' })) {
      events.push(e);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it('correctly parses "data:{...}" format without space (BUG 4 fix)', async () => {
    const event = { type: 'token', data: 'world' };
    global.fetch = jest.fn().mockResolvedValue(
      createMockResponse(`data:${JSON.stringify(event)}\n\n`)
    );

    const events = [];
    for await (const e of streamChat({ message: 'test' })) {
      events.push(e);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it('yields StreamErrorEvent on malformed JSON (BUG 3 fix)', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createMockResponse('data: {invalid json}\n\n')
    );

    const events = [];
    for await (const e of streamChat({ message: 'test' })) {
      events.push(e);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'error',
      error: 'Received malformed event from server',
    });
  });

  it('handles [DONE] sentinel correctly', async () => {
    const event = { type: 'token', data: 'hi' };
    global.fetch = jest.fn().mockResolvedValue(
      createMockResponse(
        `data: ${JSON.stringify(event)}\ndata: [DONE]\n\n`
      )
    );

    const events = [];
    for await (const e of streamChat({ message: 'test' })) {
      events.push(e);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it('passes signal to fetch (BUG 1+2 fix)', async () => {
    const controller = new AbortController();
    const event = { type: 'token', data: 'a' };
    global.fetch = jest.fn().mockResolvedValue(
      createMockResponse(`data: ${JSON.stringify(event)}\n\n`)
    );

    const events = [];
    for await (const e of streamChat({ message: 'test' }, controller.signal)) {
      events.push(e);
    }

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('yields error event when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      body: null,
    } as unknown as Response);

    const events = [];
    for await (const e of streamChat({ message: 'test' })) {
      events.push(e);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'error',
      error: 'Server returned 500: Internal Server Error',
    });
  });
});

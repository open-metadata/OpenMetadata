/*
 *  Copyright 2025 Collate.
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

import { act, render, waitFor } from '@testing-library/react';
import { io } from 'socket.io-client';
import { getOidcToken } from '../../utils/SwTokenStorageUtils';
import WebSocketProvider from './WebSocketProvider';

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

jest.mock('../../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn(),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'user-1' },
  }),
}));

jest.mock('../../utils/HistoryUtils', () => ({
  getBasePath: jest.fn().mockReturnValue(''),
}));

type Handler = (...args: unknown[]) => void;

// Stands in for socket.io-client's Socket: the handshake query lives on the manager
// options and is re-read on every connect(); connect() records the token it would send.
const createFakeSocket = () => {
  const handlers: Record<string, Handler> = {};
  const connectTokens: string[] = [];
  const opts: { query?: Record<string, string> } = {};
  const socket = {
    io: { opts },
    on: jest.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
    }),
    connect: jest.fn(() => {
      connectTokens.push(opts.query?.token ?? '');
    }),
    disconnect: jest.fn(),
  };

  return {
    socket,
    connectTokens,
    emit: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('WebSocketProvider', () => {
  let fake: ReturnType<typeof createFakeSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    fake = createFakeSocket();
    (io as jest.Mock).mockImplementation((options) => {
      fake.socket.io.opts.query = options.query;

      return fake.socket;
    });
    (getOidcToken as jest.Mock).mockResolvedValue('initial-token');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderProvider = async () => {
    const view = render(
      <WebSocketProvider>
        <div />
      </WebSocketProvider>
    );
    await waitFor(() => expect(io).toHaveBeenCalledTimes(1));

    return view;
  };

  it('opens the socket with the stored token and the current user, reconnection off', async () => {
    await renderProvider();

    expect(io).toHaveBeenCalledWith(
      expect.objectContaining({
        reconnection: false,
        query: { token: 'initial-token', userId: 'user-1' },
        transports: ['websocket'],
      })
    );
  });

  it('reconnects with the token read at reconnect time, not the one captured at init', async () => {
    await renderProvider();
    (getOidcToken as jest.Mock).mockResolvedValue('refreshed-token');

    fake.emit('disconnect', 'transport close');
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    await flushPromises();

    expect(fake.connectTokens).toEqual(['refreshed-token']);
    expect(fake.socket.io.opts.query).toEqual({
      token: 'refreshed-token',
      userId: 'user-1',
    });
  });

  it('backs off between attempts and stops after the reconnect budget', async () => {
    await renderProvider();

    const failOnce = async (delay: number) => {
      fake.emit('connect_error', new Error('401'));
      act(() => {
        jest.advanceTimersByTime(delay - 1);
      });
      await flushPromises();
      const before = fake.socket.connect.mock.calls.length;
      act(() => {
        jest.advanceTimersByTime(1);
      });
      await flushPromises();

      expect(fake.socket.connect.mock.calls.length).toBe(before + 1);
    };

    await failOnce(1000);
    await failOnce(2000);
    await failOnce(4000);

    fake.emit('connect_error', new Error('401'));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    await flushPromises();

    expect(fake.socket.connect).toHaveBeenCalledTimes(3);
  });

  it('resets the reconnect budget once a connection succeeds', async () => {
    await renderProvider();

    for (let attempt = 0; attempt < 3; attempt++) {
      fake.emit('connect_error', new Error('401'));
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      await flushPromises();
    }
    fake.emit('connect');
    fake.emit('disconnect', 'ping timeout');
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    await flushPromises();

    expect(fake.socket.connect).toHaveBeenCalledTimes(4);
  });

  it.each(['io client disconnect', 'io server disconnect'])(
    'does not retry a "%s"',
    async (reason) => {
      await renderProvider();

      fake.emit('disconnect', reason);
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      await flushPromises();

      expect(fake.socket.connect).not.toHaveBeenCalled();
    }
  );

  it('closes the socket and drops pending reconnects on unmount', async () => {
    const { unmount } = await renderProvider();
    fake.emit('disconnect', 'transport close');

    unmount();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    await flushPromises();

    expect(fake.socket.disconnect).toHaveBeenCalledTimes(1);
    expect(fake.socket.connect).not.toHaveBeenCalled();
  });
});

/*
 *  Copyright 2022 Collate.
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

import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { ROUTES } from '../../constants/constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getBasePath } from '../../utils/HistoryUtils';
import { getOidcToken } from '../../utils/SwTokenStorageUtils';

export const WebSocketContext = createContext<{ socket?: Socket }>({});

interface Props {
  children: ReactNode;
}

const RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 5000;

// socket.io's own policy: a disconnect either side asked for is not retried.
const NON_RETRIABLE_DISCONNECT_REASONS: ReadonlySet<Socket.DisconnectReason> =
  new Set(['io client disconnect', 'io server disconnect']);

type SocketDisposer = () => void;

/**
 * Keeps the handshake token current across reconnects. socket.io's built-in reconnection
 * re-sends the query captured at construction, and its `reconnect_attempt` hook fires
 * synchronously right before the engine copies that query — too early for the asynchronous
 * token read (service worker / IndexedDB). So reconnection is driven here: read the current
 * token first, then reconnect. An expired initial token can therefore never burn through the
 * reconnect budget.
 */
const driveReconnects = (socket: Socket): SocketDisposer => {
  let attempts = 0;
  let timer: number | undefined;
  let disposed = false;

  const scheduleReconnect = () => {
    if (disposed || timer || attempts >= RECONNECT_ATTEMPTS) {
      return;
    }
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** attempts,
      RECONNECT_MAX_DELAY_MS
    );
    attempts += 1;
    timer = window.setTimeout(() => {
      timer = undefined;
      void getOidcToken().then((freshToken) => {
        if (disposed) {
          return;
        }
        socket.io.opts.query = { ...socket.io.opts.query, token: freshToken };
        socket.connect();
      });
    }, delay);
  };

  socket.on('connect', () => {
    attempts = 0;
  });
  socket.on('connect_error', scheduleReconnect);
  socket.on('disconnect', (reason) => {
    if (!NON_RETRIABLE_DISCONNECT_REASONS.has(reason)) {
      scheduleReconnect();
    }
  });

  return () => {
    disposed = true;
    window.clearTimeout(timer);
    socket.disconnect();
  };
};

const WebSocketProvider: FC<Props> = ({ children }: Props) => {
  const [socket, setSocket] = useState<Socket>();
  const { currentUser } = useApplicationStore();

  // Init websocket for Feed & notification. The token read is asynchronous, so a setup can be
  // superseded (user change, unmount) while it waits; a superseded setup must not create a
  // socket, or it would publish a dead one over the working one the newer setup already made.
  const initWebSocket = useCallback(
    async (
      isSuperseded: () => boolean
    ): Promise<SocketDisposer | undefined> => {
      const basePath = getBasePath();
      const socketPath = basePath
        ? `${basePath}${ROUTES.ACTIVITY_PUSH_FEED}`
        : ROUTES.ACTIVITY_PUSH_FEED;
      // Browsers cannot set headers on the WebSocket upgrade, so the token rides the handshake
      // query — the filter validates it when the session cookie is absent (public-client SSO).
      const token = await getOidcToken();
      if (isSuperseded()) {
        return undefined;
      }
      const newSocket = io({
        path: socketPath,
        reconnection: false,
        query: {
          token,
          userId: currentUser?.id,
        },
        // Since we have load balancer in our application
        // We need to enforce transports to be websocket only
        // Refer: https://socket.io/docs/v3/using-multiple-nodes/
        transports: ['websocket'],
      });
      const dispose = driveReconnects(newSocket);
      setSocket(newSocket);

      return dispose;
    },
    [currentUser]
  );

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }
    let dispose: SocketDisposer | undefined;
    let superseded = false;
    void initWebSocket(() => superseded).then((disposer) => {
      // The cleanup can run between the socket's creation and this callback.
      if (superseded) {
        disposer?.();
      } else {
        dispose = disposer;
      }
    });

    return () => {
      superseded = true;
      dispose?.();
    };
  }, [currentUser, initWebSocket]);

  const contextValue = useMemo(() => ({ socket }), [socket]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketConnector = () => useContext(WebSocketContext);

export default WebSocketProvider;

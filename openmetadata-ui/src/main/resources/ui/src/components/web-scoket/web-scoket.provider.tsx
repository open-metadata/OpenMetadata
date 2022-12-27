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

import { observer } from 'mobx-react';
import React, {
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import AppState from '../../AppState';
import { ROUTES } from '../../constants/constants';

export const WebSocketContext = React.createContext<{ socket?: Socket }>({});

interface Props {
  children: ReactNode;
}

const WebSocketProvider: FC<Props> = ({ children }: Props) => {
  const [socket, setSocket] = useState<Socket>();

  // Update current user details of AppState change
  const currentUser = React.useMemo(() => {
    return AppState.getCurrentUserDetails();
  }, [AppState.userDetails, AppState.nonSecureUserDetails]);

  // Init websocket for Feed & notification
  const initWebSocket = useCallback(() => {
    setSocket(
      io(ROUTES.HOME, {
        path: ROUTES.ACTIVITY_PUSH_FEED,
        reconnectionAttempts: 3,
        query: {
          userId: currentUser?.id,
        },
        // Since we have load balancer in our application
        // We need to enforce transports to be websocket only
        // Refer: https://socket.io/docs/v3/using-multiple-nodes/
        transports: ['websocket'],
      })
    );
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && currentUser.id) {
      initWebSocket();
    }
  }, [currentUser]);

  return (
    <WebSocketContext.Provider value={{ socket }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketConnector = () => useContext(WebSocketContext);

export default observer(WebSocketProvider);

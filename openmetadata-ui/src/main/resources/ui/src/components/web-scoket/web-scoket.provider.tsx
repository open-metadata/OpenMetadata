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

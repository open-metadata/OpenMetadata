/*
 *  Copyright 2021 Collate
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

import { InteractionStatus } from '@azure/msal-browser';
import { useAccount, useIsAuthenticated, useMsal } from '@azure/msal-react';
import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useEffect,
  useImperativeHandle,
} from 'react';
import { useMutex } from 'react-context-mutex';
import { oidcTokenKey } from '../../constants/constants';
import { msalLoginRequest } from '../../utils/AuthProvider.util';
import { useAuthContext } from '../auth-provider/AuthProvider';
import {
  AuthenticatorRef,
  OidcUser,
} from '../auth-provider/AuthProvider.interface';

interface Props {
  children: ReactNode;
  onLoginSuccess: (user: OidcUser) => void;
  onLogoutSuccess: () => void;
}

const MsalAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLoginSuccess, onLogoutSuccess }: Props, ref) => {
    const { setIsAuthenticated, loading, setLoadingIndicator } =
      useAuthContext();
    const { instance, accounts, inProgress } = useMsal();
    const isMsalAuthenticated = useIsAuthenticated();
    const account = useAccount(accounts[0] || {});
    const MutexRunner = useMutex();
    const mutex = new MutexRunner('fetchIdToken');

    const handleOnLogoutSuccess = () => {
      for (const key in localStorage) {
        if (key.includes('-login.windows.net-') || key.startsWith('msal.')) {
          localStorage.removeItem(key);
        }
      }
      onLogoutSuccess();
    };

    const login = () => {
      setLoadingIndicator(true);
      instance.loginPopup(msalLoginRequest);
    };
    const logout = () => {
      setLoadingIndicator(false);
      handleOnLogoutSuccess();
    };

    const fetchIdToken = (): Promise<OidcUser> => {
      const tokenRequest = {
        account: account || accounts[0], // This is an example - Select account based on your app's requirements
        scopes: msalLoginRequest.scopes,
      };

      return new Promise<OidcUser>((resolve, reject) => {
        // Acquire access token
        instance
          .ssoSilent(tokenRequest)
          .then((response) => {
            // Call your API with the access token and return the data you need to save in state
            const { idToken, scopes, account } = response;
            const user = {
              // eslint-disable-next-line @typescript-eslint/camelcase
              id_token: idToken,
              scope: scopes.join(),
              profile: {
                email: account?.username || '',
                name: account?.name || '',
                picture: '',
              },
            };
            setIsAuthenticated(isMsalAuthenticated);
            localStorage.setItem(oidcTokenKey, idToken);
            resolve(user);
          })
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);

            reject(e);
          });
      });
    };

    useEffect(() => {
      const oidcUserToken = localStorage.getItem(oidcTokenKey);
      if (
        !oidcUserToken &&
        inProgress === InteractionStatus.None &&
        (accounts.length > 0 || account?.idTokenClaims)
      ) {
        mutex.run(async () => {
          mutex.lock();
          fetchIdToken()
            .then((user) => {
              if ((user as OidcUser).id_token) {
                setLoadingIndicator(false);
                onLoginSuccess(user as OidcUser);
              }
            })
            .finally(() => {
              if (loading) {
                setLoadingIndicator(false);
              }
              mutex.unlock();
            });
        });
      }
    }, [inProgress, accounts, instance, account]);

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        login();
      },
      invokeLogout() {
        logout();
      },
      renewIdToken() {
        return new Promise((resolve, reject) => {
          fetchIdToken()
            .then((user) => {
              resolve(user.id_token);
            })
            .catch((e) => {
              reject(e);
            });
        });
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

MsalAuthenticator.displayName = 'MsalAuthenticator';

export default MsalAuthenticator;

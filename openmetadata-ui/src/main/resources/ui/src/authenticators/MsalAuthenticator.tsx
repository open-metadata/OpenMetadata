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

import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from '@azure/msal-browser';
import { useAccount, useIsAuthenticated, useMsal } from '@azure/msal-react';
import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useEffect,
  useImperativeHandle,
} from 'react';
import { useAuthContext } from '../auth-provider/AuthProvider';
import {
  AuthenticatorRef,
  OidcUser,
} from '../auth-provider/AuthProvider.interface';
import { oidcTokenKey } from '../constants/constants';
import { msalLoginRequest } from '../utils/AuthProvider.util';

interface Props {
  children: ReactNode;
  onLoginSuccess: (user: OidcUser) => void;
  onLogoutSuccess: () => void;
}

export type Ref = ReactNode | HTMLElement | string;

const MsalAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLoginSuccess, onLogoutSuccess }: Props, ref) => {
    const { setIsAuthenticated, setLoadingIndicator } = useAuthContext();
    const { instance, accounts, inProgress } = useMsal();
    const isMsalAuthenticated = useIsAuthenticated();
    const account = useAccount(accounts[0] || {});

    const handleOnLogoutSucess = () => {
      for (const key in localStorage) {
        if (key.includes('-login.windows.net-') || key.startsWith('msal.')) {
          localStorage.removeItem(key);
        }
      }
      onLogoutSuccess();
    };

    const login = (loginType = 'popup') => {
      setLoadingIndicator(true);
      if (loginType === 'popup') {
        instance
          .loginPopup(msalLoginRequest)
          .finally(() => setLoadingIndicator(false));
      } else if (loginType === 'redirect') {
        instance
          .loginRedirect(msalLoginRequest)
          .finally(() => setLoadingIndicator(false));
      }
    };
    const logout = () => {
      // TODO: Uncomment if need to logout from browser
      // if (logoutType === 'popup') {
      //   instance
      //     .logoutPopup({
      //       mainWindowRedirectUri: ROUTES.HOME,
      //     })
      //     .then(() => {
      //       handleOnLogoutSucess();
      //     });
      // } else if (logoutType === 'redirect') {
      //   instance.logoutRedirect().then(() => {
      //     handleOnLogoutSucess();
      //   });
      // }
      setLoadingIndicator(false);
      handleOnLogoutSucess();
    };

    useEffect(() => {
      const oidcUserToken = localStorage.getItem(oidcTokenKey);
      if (
        !oidcUserToken &&
        inProgress === InteractionStatus.None &&
        (accounts.length > 0 || account?.idTokenClaims)
      ) {
        const tokenRequest = {
          account: account || accounts[0], // This is an example - Select account based on your app's requirements
          scopes: msalLoginRequest.scopes,
        };

        // Acquire an access token
        instance
          .acquireTokenSilent(tokenRequest)
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
            onLoginSuccess(user);
          })
          .catch(async (e) => {
            // Catch interaction_required errors and call interactive method to resolve
            if (e instanceof InteractionRequiredAuthError) {
              await instance.acquireTokenRedirect(tokenRequest);
            }

            throw e;
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
        return Promise.resolve('');
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

MsalAuthenticator.displayName = 'MsalAuthenticator';

export default MsalAuthenticator;

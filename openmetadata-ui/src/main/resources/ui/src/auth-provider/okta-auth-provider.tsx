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

import { IDToken, OktaAuth } from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import React, { FunctionComponent, ReactNode } from 'react';
import { oidcTokenKey } from '../constants/constants';
import { useAuthContext } from './AuthProvider';
import { OidcUser } from './AuthProvider.interface';

interface Props {
  children: ReactNode;
  onLoginSuccess: (user: OidcUser) => void;
}

export const OktaAuthProvider: FunctionComponent<Props> = ({
  children,
  onLoginSuccess,
}: Props) => {
  const { authConfig, setIsAuthenticated } = useAuthContext();
  const { clientId, issuer, redirectUri, scopes, pkce } = authConfig;
  const oktaAuth = new OktaAuth({
    clientId,
    issuer,
    redirectUri,
    scopes,
    pkce,
  });

  const triggerLogin = async () => {
    await oktaAuth.signInWithRedirect();
  };

  const restoreOriginalUri = async (_oktaAuth: OktaAuth) => {
    const idToken =
      _oktaAuth?.authStateManager?._authState?.idToken || ({} as IDToken);
    localStorage.setItem(oidcTokenKey, idToken?.idToken || '');
    _oktaAuth
      .getUser()
      .then((info) => {
        setIsAuthenticated(true);
        const user = {
          // eslint-disable-next-line @typescript-eslint/camelcase
          id_token: idToken.idToken,
          scope: idToken.scopes.join(),
          profile: {
            email: info.email || '',
            name: info.name || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            picture: (info as any).imageUrl || '',
            locale: info.locale || '',
          },
        };
        onLoginSuccess(user);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
      });

    return;
  };

  const customAuthHandler = async () => {
    const previousAuthState = oktaAuth.authStateManager.getPreviousAuthState();
    if (!previousAuthState || !previousAuthState.isAuthenticated) {
      // App initialization stage
      await triggerLogin();
    } else {
      // Ask the user to trigger the login process during token autoRenew process
    }
  };

  return (
    <Security
      oktaAuth={oktaAuth}
      restoreOriginalUri={restoreOriginalUri}
      onAuthRequired={customAuthHandler}>
      {children}
    </Security>
  );
};

export default OktaAuthProvider;

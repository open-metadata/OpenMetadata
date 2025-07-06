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

import { OktaAuth, OktaAuthOptions } from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import { FunctionComponent, ReactNode, useCallback, useMemo } from 'react';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { setOidcToken } from '../../../utils/LocalStorageUtils';
import { useAuthProvider } from './AuthProvider';

interface Props {
  children: ReactNode;
}

export const OktaAuthProvider: FunctionComponent<Props> = ({
  children,
}: Props) => {
  const { authConfig } = useApplicationStore();
  const { handleSuccessfulLogin } = useAuthProvider();

  const { clientId, issuer, redirectUri, scopes, pkce } =
    authConfig as unknown as OktaAuthOptions;

  const oktaAuth = useMemo(
    () =>
      new OktaAuth({
        clientId,
        issuer,
        redirectUri,
        scopes,
        pkce,
        tokenManager: {
          autoRenew: true,
          storage: 'localStorage',
          syncStorage: true,
          expireEarlySeconds: 60,
          secure: true,
        },
        cookies: {
          secure: true,
          sameSite: 'lax',
        },
        services: {
          autoRenew: true,
          renewOnTabActivation: true,
          tabInactivityDuration: 3600,
        },
      }),
    [clientId, issuer, redirectUri, scopes, pkce]
  );

  const triggerLogin = async () => {
    await oktaAuth.signInWithRedirect();
  };

  const customAuthHandler = async () => {
    const previousAuthState = oktaAuth.authStateManager.getPreviousAuthState();
    if (!previousAuthState?.isAuthenticated) {
      // Clear storage before triggering login
      oktaAuth.tokenManager.clear();
      await oktaAuth.signOut();
      // App initialization stage
      await triggerLogin();
    } else {
      // Ask the user to trigger the login process during token autoRenew process
    }
  };

  const restoreOriginalUri = useCallback(
    async (_oktaAuth: OktaAuth) => {
      const idToken = _oktaAuth.getIdToken() ?? '';
      const scopes =
        _oktaAuth.authStateManager.getAuthState()?.idToken?.scopes.join() || '';
      setOidcToken(idToken);
      _oktaAuth
        .getUser()
        .then((info) => {
          const user = {
            id_token: idToken,
            scope: scopes,
            profile: {
              email: info.email ?? '',
              name: info.name ?? '',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              picture: (info as any).imageUrl ?? '',
              locale: info.locale ?? '',
              sub: info.sub,
            },
          };
          handleSuccessfulLogin(user);
        })
        .catch(async (err) => {
          // eslint-disable-next-line no-console
          console.error(err);
          // Redirect to login on error
          await customAuthHandler();
        });
    },
    [handleSuccessfulLogin]
  );

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

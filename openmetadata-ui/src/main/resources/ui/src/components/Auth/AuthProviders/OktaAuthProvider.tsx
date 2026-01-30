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
  AccessToken,
  EVENT_RENEWED,
  IDToken,
  OktaAuth,
  OktaAuthOptions,
} from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import { FunctionComponent, ReactNode, useEffect, useMemo } from 'react';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
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
          storage: 'memory',
          syncStorage: true,
          expireEarlySeconds: 60,
          secure: true,
        },
      }),
    [clientId, issuer, redirectUri, scopes, pkce]
  );

  useEffect(() => {
    const handleTokenRenewed = async (
      key: string,
      newToken: IDToken | AccessToken
    ) => {
      if (key === 'idToken' && 'idToken' in newToken && newToken.idToken) {
        await setOidcToken(newToken.idToken);
      }
    };

    oktaAuth.tokenManager.on(EVENT_RENEWED, handleTokenRenewed);

    return () => {
      oktaAuth.tokenManager.off(EVENT_RENEWED, handleTokenRenewed);
    };
  }, [oktaAuth]);

  const restoreOriginalUri = async () => {
    const idToken = oktaAuth.getIdToken() ?? '';
    const scopes =
      oktaAuth.authStateManager.getAuthState()?.idToken?.scopes.join() || '';

    await setOidcToken(idToken);

    try {
      const info = await oktaAuth.getUser();
      const user = {
        id_token: idToken,
        scope: scopes,
        profile: {
          email: info.email ?? '',
          name: info.name ?? '',
          picture: (info as any).imageUrl ?? '',
          locale: info.locale ?? '',
          sub: info.sub,
        },
      };
      handleSuccessfulLogin(user);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to restore original URI:', error);
      await oktaAuth.signInWithRedirect();
    }
  };

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      {children}
    </Security>
  );
};

export default OktaAuthProvider;

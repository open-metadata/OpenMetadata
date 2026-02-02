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
  EVENT_RENEWED,
  isIDToken,
  OktaAuth,
  OktaAuthOptions,
  Token,
} from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import {
  FunctionComponent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { OktaCustomStorage } from '../../../utils/OktaCustomStorage';
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

  const config = authConfig as unknown as OktaAuthOptions;
  const { clientId, issuer, redirectUri, scopes, pkce } = config;

  const customStorage = useMemo(() => new OktaCustomStorage(), []);

  const oktaAuth = useMemo(() => {
    const oktaConfig: OktaAuthOptions = {
      clientId,
      issuer,
      redirectUri,
      scopes,
      pkce,
      tokenManager: {
        autoRenew: true,
        storage: customStorage,
        syncStorage: true,
        secure: true,
      },
      cookies: {
        secure: true,
        sameSite: 'lax',
      },
      services: {
        autoRenew: true,
        renewOnTabActivation: true,
      },
    };

    return new OktaAuth(oktaConfig);
  }, [customStorage, clientId, issuer, redirectUri, scopes, pkce]);

  useEffect(() => {
    const initializeTokenManager = async () => {
      if (!oktaAuth.tokenManager.isStarted()) {
        await customStorage.waitForInit();
        await oktaAuth.tokenManager.start();
      }
    };

    initializeTokenManager().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize Okta token manager:', error);
    });

    const handleTokenRenewed = async (key: string, newToken: Token) => {
      if (key === 'idToken' && isIDToken(newToken)) {
        const idToken = newToken.idToken;
        if (idToken) {
          await setOidcToken(idToken);
        }
      }
    };

    oktaAuth.tokenManager.on(EVENT_RENEWED, handleTokenRenewed);

    return () => {
      oktaAuth.tokenManager.off(EVENT_RENEWED, handleTokenRenewed);
    };
  }, [oktaAuth, customStorage]);

  const restoreOriginalUri = useCallback(async () => {
    const idToken = oktaAuth.getIdToken() ?? '';
    const scopes =
      oktaAuth.authStateManager.getAuthState()?.idToken?.scopes.join() || '';

    await setOidcToken(idToken);

    try {
      const info = await oktaAuth.getUser<{ imageUrl?: string }>();
      const user = {
        id_token: idToken,
        scope: scopes,
        profile: {
          email: info.email ?? '',
          name: info.name ?? '',
          picture: info.imageUrl ?? '',
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
  }, [oktaAuth, handleSuccessfulLogin]);

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      {children}
    </Security>
  );
};

export default OktaAuthProvider;

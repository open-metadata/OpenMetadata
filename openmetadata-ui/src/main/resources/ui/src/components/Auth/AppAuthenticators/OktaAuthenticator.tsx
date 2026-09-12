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

import { useOktaAuth } from '@okta/okta-react';
import {
  forwardRef,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import { authCoordinator, Renewer } from '../../../utils/Auth/AuthCoordinator';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { useAuthProvider } from '../AuthProviders/AuthProvider';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';

interface Props {
  children: ReactNode;
}

const OktaAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children }: Props, ref) => {
    const { oktaAuth } = useOktaAuth();
    const { handleSuccessfulLogout } = useAuthProvider();

    const login = async () => {
      oktaAuth.signInWithRedirect();
    };

    const logout = async () => {
      try {
        oktaAuth.tokenManager.clear();
      } finally {
        handleSuccessfulLogout();
      }
    };

    const renewToken = async () => {
      try {
        const [existingIdToken, existingAccessToken] = await Promise.all([
          oktaAuth.tokenManager.get('idToken'),
          oktaAuth.tokenManager.get('accessToken'),
        ]);

        // Add fallback if renewToken fails
        // Redirect to sign-in if no tokens exist
        if (!existingIdToken && !existingAccessToken) {
          oktaAuth.signInWithRedirect();

          return '';
        }

        const tokens = await oktaAuth.token.renewTokens();
        oktaAuth.tokenManager.setTokens(tokens);
        const newToken =
          tokens?.idToken?.idToken ?? oktaAuth.getIdToken() ?? '';
        await setOidcToken(newToken);

        return newToken;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error renewing Okta token:', error);
        oktaAuth.signInWithRedirect();
      }

      return '';
    };

    // Bridges to the AuthCoordinator Renewer contract. Reads the raw Tokens
    // shape directly instead of going through setOidcToken (the AuthCoordinator
    // owns app-side storage now), but must still hand the renewed set to
    // Okta's own tokenManager so subsequent SDK reads/renewals don't see the
    // expired tokens.
    const getRenewer = useCallback(
      (): Renewer => async () => {
        const tokens = await oktaAuth.token.renewTokens();

        if (!tokens.idToken?.idToken) {
          throw new Error('Okta renewal returned no idToken');
        }

        oktaAuth.tokenManager.setTokens(tokens);

        return {
          idToken: tokens.idToken.idToken,
          expiresAt: tokens.idToken.expiresAt * 1000,
        };
      },
      [oktaAuth]
    );

    useImperativeHandle(ref, () => ({
      invokeLogin: login,
      invokeLogout: logout,
      renewIdToken: renewToken,
    }));

    // Register the coordinator renewer directly from this authenticator's
    // own mount effect (avoids the ref-based race in the parent).
    useEffect(() => {
      authCoordinator.registerRenewer(getRenewer());

      return () => authCoordinator.registerRenewer(null);
    }, [getRenewer]);

    return <Fragment>{children}</Fragment>;
  }
);

OktaAuthenticator.displayName = 'OktaAuthenticator';

export default OktaAuthenticator;

/*
 *  Copyright 2024 Collate.
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
import type { AxiosError } from 'axios';
import {
  forwardRef,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import { HTTP_STATUS_CODE } from '../../../constants/Auth.constants';
import { ROUTES } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { logoutUser, renewToken } from '../../../rest/LoginAPI';
import { authCoordinator } from '../../../utils/Auth/AuthCoordinator/AuthCoordinator';
import { ReauthRequiredError } from '../../../utils/Auth/AuthCoordinator/ReauthRequiredError';
import type { Renewer } from '../../../utils/Auth/AuthCoordinator/types';
import { extractDetailsFromToken } from '../../../utils/AuthProvider.util';
import { getBasePath } from '../../../utils/HistoryUtils';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { useAuthProvider } from '../AuthProviders/AuthProvider';

// Absolute so it also resolves from a deep link, which a silent re-auth can
// start from; a relative path would be taken relative to that page.
const buildLoginUrl = (prompt?: string) => {
  const params = new URLSearchParams({
    redirectUri: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
  });
  if (prompt) {
    params.set('prompt', prompt);
  }

  return `${getBasePath()}/api/v1/auth/login?${params.toString()}`;
};

// /auth/refresh answers 401 once the OpenMetadata session is gone (expired,
// revoked, or ended by the identity provider). The identity provider session
// may well be alive, so this is a case for re-authenticating, not signing out.
const isSessionEnded = (error: unknown): boolean =>
  (error as AxiosError | undefined)?.response?.status ===
  HTTP_STATUS_CODE.UNAUTHORISED;

export const GenericAuthenticator = forwardRef(
  ({ children }: { children: ReactNode }, ref) => {
    const { setIsAuthenticated, setIsSigningUp } = useApplicationStore();
    const { handleSuccessfulLogout } = useAuthProvider();

    const handleLogin = () => {
      setIsAuthenticated(false);
      setIsSigningUp(true);
      window.location.assign(buildLoginUrl());
    };

    // The server skips the identity provider entirely while the OpenMetadata
    // session is still active, and SAML ignores prompt.
    const handleSilentReauth = async () => {
      window.location.assign(buildLoginUrl('none'));
    };

    const handleLogout = async () => {
      try {
        await logoutUser();
      } finally {
        // This will cleanup the application state and redirect to login page
        handleSuccessfulLogout();
      }
    };

    const handleSilentSignIn = async () => {
      const resp = await renewToken();
      await setOidcToken(resp.accessToken);

      return resp;
    };

    // Bridges to the AuthCoordinator Renewer contract (auth-coordinator-refactor
    // Task 8). Kept alongside handleSilentSignIn/renewIdToken until every
    // authenticator is migrated and the old TokenService path is deleted.
    const getRenewer = useCallback(
      (): Renewer => async () => {
        let response;
        try {
          response = await renewToken();
        } catch (error) {
          if (isSessionEnded(error)) {
            throw new ReauthRequiredError(
              'OpenMetadata session ended; re-authentication required',
              error
            );
          }

          throw error;
        }
        if (!response?.accessToken) {
          throw new Error('Renew endpoint returned no accessToken');
        }
        const decoded = extractDetailsFromToken(response.accessToken);

        return {
          idToken: response.accessToken,
          expiresAt: (decoded.exp ?? 0) * 1000,
        };
      },
      []
    );

    useImperativeHandle(ref, () => ({
      invokeLogout: handleLogout,
      renewIdToken: handleSilentSignIn,
      invokeLogin: handleLogin,
      invokeSilentReauth: handleSilentReauth,
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
